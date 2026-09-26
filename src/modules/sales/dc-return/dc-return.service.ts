import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDrCr } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { DcFulfilmentService } from '../posting/dc-fulfilment.service';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { GstGatewayService } from '../posting/gst-gateway.service';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { SalesDocStore, type DocKeys, type DocRow, type DocSpec } from '../posting/sales-doc-store';
import { buildCogsLegs } from '../posting/sales-leg.sources';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { SalesStockService } from '../posting/sales-stock.service';
import { StatutoryService } from '../../../common/posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import {
  assertAccYearWritable,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
  refuse,
} from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRefusals, throwSalesRight } from '../posting/sales.errors';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type SalesGuardContext,
} from '../posting/types/posting.types';
import type { RegisterDoc } from '../../../common/posting/doc-register.types';
import {
  SALES_MENU_ID,
  SALES_VOUCHER_TYPE,
  isoDate,
  isoToday,
  num,
  numericTail,
  round2,
  supplyNatureOf,
} from '../posting/sales-doc.utils';
import {
  SDR_DATE_FIELDS,
  SDR_OPTIONAL_FIELDS,
  SDR_SERVER_OWNED,
  type SaveDcReturnDto,
} from './dto/save-dc-return.dto';
import { SDRI_DATE_FIELDS, SDRI_OPTIONAL_FIELDS } from './dto/save-dc-return-item.dto';
import type {
  CancelDcReturnDto,
  DcReturnKeysDto,
  DcReturnTransportDto,
  PostDcReturnDto,
} from './dto/dc-return-lifecycle.dto';

/**
 * HANDOVER §5 — `/api/v1/dc-returns`, the strictest of the four documents.
 *
 * Goods come back against a POSTED challan. Stock IN (DC_RETURN, bucket by
 * condition), the COGS pair reversed under PERPETUAL on a `DCR` voucher, a
 * CHALLAN register row inward for the e-way bill. NO amend, ever: a mistake is
 * cancel + re-enter. The band is its only editable surface after POSTED.
 */
export const DCR_SPEC: DocSpec = {
  kind: 'DC_RETURN',
  headerDelegate: 'saleDcReturn',
  itemDelegate: 'saleDcReturnItem',
  p: 'sdr',
  ip: 'sdri',
  itemFk: 'sdriReturnId',
  refnoField: 'sdrReturnRefno',
  slnoField: 'sdrReturnSlno',
  dateField: 'sdrReturnDate',
  datetimeField: 'sdrReturnDatetime',
  custField: 'sdrCustId',
  custNameField: 'sdrCustName',
  revisionField: null,
  voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
  menuId: SALES_MENU_ID.DC_RETURN,
  statusDocType: TxnStatusDocType.OTHER,
  chargeDocType: null,
  tenderDocType: null,
  tenderDrCr: TenderDrCr.CR,
  transportDocType: 'DC_RETURN',
  transportDirection: 'INWARD',
  tableName: 'sale_dc_return',
  itemTableName: 'sale_dc_return_item',
  screenName: 'DC Return',
  optionalFields: SDR_OPTIONAL_FIELDS,
  dateFields: SDR_DATE_FIELDS,
  serverOwned: SDR_SERVER_OWNED,
  itemOptionalFields: SDRI_OPTIONAL_FIELDS,
  itemDateFields: SDRI_DATE_FIELDS,
  itemRequired: ['sdriDcItemId', 'sdriItemId', 'sdriItemUnitId', 'sdriGodownId'],
  // sdrDcId / sdrDcAccYear are the challan the return answers: required by
  // the DTO, NOT NULL on the table, and not among the optional fields the
  // store copies — so they are named here or Prisma asks for the `dc` relation.
  headerRequired: ['sdrCounterId', 'sdrDcId', 'sdrDcAccYear'],
  itemDefaults: (h) => ({ sdriPriceLevel: 1, sdriDcAccYear: h.sdrDcAccYear }),
  headerWhereUnique: 'sdrId_sdrAccYear',
  itemWhereUnique: 'sdriId_sdriAccYear',
};

const BUCKET_BY_CONDITION: Record<string, string> = {
  RESTOCK: 'SALEABLE',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  SCRAP: 'QUARANTINE',
};
const TX = { timeout: 60_000, maxWait: 10_000 } as const;

@Injectable()
export class DcReturnService {
  private readonly store: SalesDocStore;

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly statutory: StatutoryService,
    private readonly legs: VoucherPostingService,
    private readonly register: DocRegisterService,
    private readonly stock: SalesStockService,
    private readonly blocks: SalesDocBlocksService,
    private readonly transportBand: TransportBandService,
    private readonly fulfilment: DcFulfilmentService,
    private readonly gst: GstGatewayService,
    audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
  ) {
    this.store = new SalesDocStore(DCR_SPEC, audit, charges, tenders, transportBand);
  }

  private keys(dto: DcReturnKeysDto): DocKeys {
    return {
      id: dto.sdrId,
      companyId: dto.sdrCompanyId,
      branchId: dto.sdrBranchId,
      accYear: dto.sdrAccYear,
    };
  }

  async save(dto: SaveDcReturnDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      // The challan is copied onto the header once, from the master row.
      const [dc] = await tx.$queryRaw<
        {
          sdc_dc_refno: string;
          sdc_dc_date: Date;
          sdc_cust_id: string;
          sdc_cust_name: string | null;
          sdc_cust_gstin: string | null;
          sdc_cust_stcd: string | null;
          sdc_pos_stcd: string | null;
          sdc_status: string;
        }[]
      >`
        SELECT sdc_dc_refno, sdc_dc_date, sdc_cust_id, sdc_cust_name, sdc_cust_gstin, sdc_cust_stcd, sdc_pos_stcd, sdc_status
          FROM sales.sale_dc WHERE sdc_id = ${dto.sdrDcId}::uuid AND sdc_acc_year = ${dto.sdrDcAccYear}::char(9) AND sdc_is_deleted = false`;
      if (!dc) {
        throwSalesLocked(
          'The challan this return is against does not exist',
          SALES_ERROR_CODES.DCR_DC_NOT_POSTED,
          'sdrDcId',
        );
      }
      const body: DocRow = {
        ...(dto as unknown as DocRow),
        sdrDcRefno: dc.sdc_dc_refno,
        sdrDcDate: isoDate(dc.sdc_dc_date),
        sdrCustId: dto.sdrCustId ?? dc.sdc_cust_id,
        sdrCustName: dto.sdrCustName ?? dc.sdc_cust_name,
        sdrCustGstin: dto.sdrCustGstin ?? dc.sdc_cust_gstin,
        sdrCustStcd: dto.sdrCustStcd ?? dc.sdc_cust_stcd,
        sdrPosStcd: dto.sdrPosStcd ?? dc.sdc_pos_stcd,
      };
      return this.store.saveDraft(tx, body, actor, now, {
        beforeWrite: (data) => {
          if (data.sdrReturnDatetime === undefined) {
            data.sdrReturnDatetime = now;
          }
        },
      });
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const row = await this.store.findOrThrow(c, keys);
    const [items, transport, rights, gdrId] = await Promise.all([
      this.store.loadItems(c, row),
      this.store.loadTransport(c, row),
      this.salesContext.rights(DCR_SPEC.menuId, c),
      this.register.registerIdOf(c, keys.id, keys.accYear),
    ]);
    const { posting, locks } = await this.blocks.build(
      {
        status: row.sdrStatus as string,
        companyId: keys.companyId,
        branchId: keys.branchId,
        accYear: keys.accYear,
        docDate: isoDate(row.sdrReturnDate as Date) ?? isoToday(),
        voucherId: (row.sdrPostedVoucherId as string | null) ?? null,
        registerId: gdrId,
        cogsAmt: num(row.sdrTotalCost as Prisma.Decimal),
        // No amend on this document at all: lock 1 is final.
        amendable: row.sdrStatus === 'DRAFT',
      },
      c,
    );
    return {
      ...this.store.plain(row),
      items: items.map((i) => this.store.plain(i)),
      transport,
      posting,
      locks,
      rights: { ...rights, amend: false },
    };
  }

  async delete(dto: DcReturnKeysDto): Promise<{ sdrId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(
      (tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()),
      TX,
    );
    return { sdrId: dto.sdrId, deleted: true };
  }

  /** §5 — `GET /dc-returns/open-lines?sdcId&sdcAccYear`. */
  async openLines(sdcId: string, sdcAccYear: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT d.sdi_id AS "dcItemId", d.sdi_line_no AS "lineNo", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             d.sdi_item_id AS "itemId", d.sdi_item_unit_id AS "itemUnitId",
             d.sdi_dc_qty AS "dcQty", d.sdi_billed_qty AS "billedQty", d.sdi_returned_qty AS "returnedQty", d.sdi_open_qty AS "openQty",
             d.sdi_lot_id AS "lotId", d.sdi_batch_no AS "batchNo", d.sdi_godown_id AS "godownId", d.sdi_rate AS "rate",
             d.sdi_tax_perc AS "taxPerc", d.sdi_tax_id AS "taxId", d.sdi_hsn_code AS "hsnCode", d.sdi_cost_price AS "costPrice"
        FROM sales.sale_dc_item d
        JOIN inventory.item_master im ON im.item_id = d.sdi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = d.sdi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE d.sdi_dc_id = ${sdcId}::uuid AND d.sdi_acc_year = ${sdcAccYear}::char(9) AND d.sdi_is_deleted = false
       ORDER BY d.sdi_line_no`;
    return rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v instanceof Prisma.Decimal ? Number(v.toString()) : v,
        ]),
      ),
    );
  }

  // ── post ─────────────────────────────────────────────────────────────────

  async post(dto: PostDcReturnDto): Promise<Record<string, unknown>> {
    let fire: { gdrId: string | null; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdrStatus === 'POSTED') {
        return;
      }
      if (row.sdrStatus === 'CANCELLED') {
        throwSalesLocked('This DC return is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'sdrId');
      }
      const ctx = await this.salesContext.resolve(
        {
          companyId: row.sdrCompanyId as string,
          branchId: row.sdrBranchId as string,
          deviceId: row.sdrDeviceId as string | null,
        },
        DCR_SPEC.menuId,
        tx,
      );
      if (!ctx.rights.post) {
        throwSalesRight('This user may not post on this menu', SALES_ERROR_CODES.RIGHT_POST);
      }
      const items = await this.store.loadItems(tx, row);
      const g = createGuardContext({ canOverride: ctx.rights.override, throwOnRefusal: false });
      await this.guards(tx, row, items, ctx, g);
      if (g.refusals.length > 0) {
        throwSalesRefusals('DC return cannot be posted', g.refusals);
      }
      fire = await this.postCore(tx, row, items, ctx, new Date());
    }, TX);
    if (fire) {
      const f = fire as { gdrId: string | null; ewaybill: boolean };
      this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
    }
    return this.get(this.keys(dto));
  }

  private async guards(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
  ): Promise<void> {
    const keys = this.store.keysOf(row);
    const docDate = isoDate(row.sdrReturnDate as Date) ?? isoToday();
    await assertAccYearWritable(tx, keys.companyId, keys.accYear, 'sdrAccYear');
    await assertVoucherPartitionExists(tx, keys.accYear, 'sdrAccYear');
    if (docDate > isoToday()) {
      refuse(g, SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
        field: 'sdrReturnDate',
      });
    }
    if (await loadDayClosed(tx, keys.companyId, keys.branchId, docDate)) {
      refuse(
        g,
        SALES_ERROR_CODES.DAY_CLOSED,
        `The books for ${docDate} are closed at this branch`,
        { field: 'sdrReturnDate' },
      );
    }
    const [dc] = await tx.$queryRaw<{ sdc_status: string }[]>`
      SELECT sdc_status FROM sales.sale_dc WHERE sdc_id = ${row.sdrDcId as string}::uuid AND sdc_acc_year = ${row.sdrDcAccYear as string}::char(9) AND sdc_is_deleted = false`;
    if (!dc || dc.sdc_status !== 'POSTED') {
      refuse(
        g,
        SALES_ERROR_CODES.DCR_DC_NOT_POSTED,
        'The challan this return is against is not POSTED',
        { field: 'sdrDcId' },
      );
    }
    if (items.length === 0) {
      refuse(g, SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A return with no lines cannot be posted', {
        field: 'items',
      });
    }
    const dcLines = await tx.$queryRaw<{ sdi_id: string; sdi_open_qty: Prisma.Decimal | null }[]>`
      SELECT sdi_id, sdi_open_qty FROM sales.sale_dc_item WHERE sdi_id = ANY(${items.map((i) => i.sdriDcItemId as string)}::uuid[])`;
    const open = new Map(dcLines.map((l) => [l.sdi_id, num(l.sdi_open_qty)]));
    const taken = new Map<string, number>();
    for (const i of items) {
      const k = i.sdriDcItemId as string;
      taken.set(
        k,
        (taken.get(k) ?? 0) +
          num(i.sdriReturnQty as Prisma.Decimal) +
          num(i.sdriFreeQty as Prisma.Decimal),
      );
    }
    for (const [k, qty] of taken) {
      const o = open.get(k);
      if (o === undefined) {
        refuse(g, SALES_ERROR_CODES.DCR_OVER_OPEN, `Challan line ${k} does not exist`, {
          field: 'items',
        });
      } else if (qty > o + 0.0005) {
        refuse(
          g,
          SALES_ERROR_CODES.DCR_OVER_OPEN,
          `Challan line has ${o} open; this return takes ${qty}`,
          { field: 'items' },
        );
      }
    }
    void ctx;
  }

  private async postCore(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    now: Date,
  ): Promise<{ gdrId: string | null; ewaybill: boolean }> {
    const keys = this.store.keysOf(row);
    const actor = ctx.actor;
    const refno = (row.sdrReturnRefno as string) ?? keys.id;
    const docDate = isoDate(row.sdrReturnDate as Date) ?? isoToday();
    const moving = items.filter(
      (i) =>
        !(i.sdriIsService as boolean) &&
        num(i.sdriReturnQty as Prisma.Decimal) + num(i.sdriFreeQty as Prisma.Decimal) > 0,
    );

    // 1 · the goods come back, into the bucket their condition says.
    const stock = await this.stock.post(
      tx,
      {
        docType: 'DC_RETURN',
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        tenantId: row.sdrTenantId as string | null,
        deviceId: row.sdrDeviceId as string | null,
        sessionId: row.sdrSessionId as string | null,
        docDate,
        docDatetime: (row.sdrReturnDatetime as Date | null) ?? now,
        refno,
        revision: 1,
        partyId: row.sdrCustId as string | null,
        direction: 'IN',
        txnType: 'DC_RETURN',
        lines: moving.map((i) => ({
          lineId: i.sdriId as string,
          lineNo: i.sdriLineNo as number,
          itemId: i.sdriItemId as string,
          itemUnitId: i.sdriItemUnitId as string,
          godownId: i.sdriGodownId as string,
          lotId: i.sdriLotId as string | null,
          bucket:
            (i.sdriBucket as string | null) ??
            BUCKET_BY_CONDITION[(i.sdriCondition as string) ?? 'RESTOCK'] ??
            'SALEABLE',
          qty: num(i.sdriReturnQty as Prisma.Decimal),
          freeQty: num(i.sdriFreeQty as Prisma.Decimal),
          weightQty: i.sdriWeightQty === null ? null : num(i.sdriWeightQty as Prisma.Decimal),
          toBaseFactor: num(i.sdriToBaseFactor as Prisma.Decimal) || null,
          batchNo: i.sdriBatchNo as string | null,
          expiryDate: isoDate(i.sdriExpiryDate as Date | null),
          serialNo: i.sdriSerialNo as string | null,
          mrp: i.sdriMaxPrice === null ? null : num(i.sdriMaxPrice as Prisma.Decimal),
          rate: num(i.sdriRate as Prisma.Decimal),
          // Goods come back at the cost they left at.
          costRate: num(i.sdriCostPrice as Prisma.Decimal) || null,
          taxPerc: num(i.sdriTaxPerc as Prisma.Decimal),
        })),
      },
      actor,
      now,
    );
    for (const i of moving) {
      await this.store.updateItem(tx, i, {
        sdriLotId: stock.lotByLine.get(i.sdriId as string) ?? i.sdriLotId ?? null,
      });
    }

    // 2 · the COGS pair reversed, under PERPETUAL.
    let voucherId: string | null = null;
    let voucherLastNo: bigint | null = null;
    const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
    if (cogs > 0 && row.sdrCustId) {
      const v = await this.legs.postLegs(tx, {
        header: {
          companyId: keys.companyId,
          branchId: keys.branchId,
          tenantId: row.sdrTenantId as string | null,
          accYear: keys.accYear,
          voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
          voucherDate: docDate,
          srcModule: 'SALES',
          srcDocType: 'DC_RETURN',
          srcDocId: keys.id,
          docRefno: refno,
          docDate,
          usrRefno: row.sdrUsrRefno as string | null,
          docAmount: num(row.sdrReturnAmt as Prisma.Decimal),
          partyId: row.sdrCustId as string,
          userId: isUuid(row.sdrUserId as string) ? (row.sdrUserId as string) : actor,
          sessionId: row.sdrSessionId as string | null,
          deviceType: row.sdrDeviceType as string | null,
          remarks: row.sdrRemarks as string | null,
          createdBy: actor,
          presetRefno: row.sdrReturnRefno as string,
          presetNo: row.sdrReturnSlno as bigint | null,
        },
        legs: buildCogsLegs(cogs, 'RETURN'),
      });
      voucherId = v.voucherId;
      voucherLastNo = v.voucherLastNo;
    }

    // 3 · the register: a CHALLAN, inward, for the e-way bill.
    const [company] = await tx.$queryRaw<
      { comp_state_code: string | null }[]
    >`SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
    const nature = supplyNatureOf(company?.comp_state_code, row.sdrPosStcd as string | null);
    let gdrId: string | null = null;
    let ewaybill = false;
    if (row.sdrCustId) {
      const reg = await this.register.write(
        tx,
        this.registerDoc(row, items, voucherId, voucherLastNo, nature, actor),
        { interState: nature === 'INTER' },
      );
      gdrId = reg.gdrId;
      ewaybill = reg.ewaybillApplicable;
    }

    await this.store.setStatus(
      tx,
      row,
      'POSTED',
      {
        sdrPostedVoucherId: voucherId,
        sdrTotalCost: new Prisma.Decimal(stock.cogsTotal.toFixed(2)),
      },
      actor,
      now,
    );
    await this.fulfilment.recompute(
      tx,
      [{ dcId: row.sdrDcId as string, accYear: (row.sdrDcAccYear as string).trim() }],
      actor,
      now,
    );
    await this.store.trail(tx, row, TxnStatusEvent.POSTED, 'DRAFT', 'POSTED', actor, now, null);
    await this.store.auditChange(
      tx,
      row,
      'approve',
      { sdrStatus: 'DRAFT' },
      { sdrStatus: 'POSTED', sdrPostedVoucherId: voucherId, gdrId, cogs },
      actor,
      'DC return posted',
    );
    return { gdrId, ewaybill };
  }

  private registerDoc(
    row: DocRow,
    items: DocRow[],
    voucherId: string | null,
    voucherNo: bigint | null,
    nature: 'INTRA' | 'INTER',
    actor: string,
  ): RegisterDoc {
    const d = (k: string) => num(row[k] as Prisma.Decimal);
    return {
      companyId: row.sdrCompanyId as string,
      branchId: row.sdrBranchId as string,
      accYear: row.sdrAccYear as string,
      voucherId: voucherId ?? (row.sdrId as string),
      voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
      voucherNo:
        (row.sdrReturnSlno as bigint | null) ??
        voucherNo ??
        numericTail(row.sdrReturnRefno as string, BigInt(0)),
      voucherDate: isoDate(row.sdrReturnDate as Date)!,
      voucherRefno: row.sdrReturnRefno as string,
      sourceDocId: row.sdrId as string,
      docType: 'CHALLAN',
      tranNature: 'DELIVERY_CHALLAN',
      docFlow: 'INWARD',
      docSign: -1,
      docNo: row.sdrReturnRefno as string,
      docDate: isoDate(row.sdrReturnDate as Date)!,
      docRefNo: row.sdrDcRefno as string | null,
      taxability: d('sdrTaxAmt') > 0 ? 'TAXABLE' : 'EXEMPT',
      supplyClass: 'GOODS',
      supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      placeOfSupplyCode: row.sdrPosStcd as string | null,
      partyId: row.sdrCustId as string,
      partyName: row.sdrCustName as string | null,
      partyStateCode: row.sdrCustStcd as string | null,
      partyGstin: ((row.sdrCustGstin as string | null) ?? '').trim() || null,
      grossValue: d('sdrGrossAmt'),
      discountValue: 0,
      taxableValue: d('sdrTaxableAmt'),
      cgstValue: 0,
      sgstValue: 0,
      igstValue: 0,
      cessValue: 0,
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: 0,
      roundOff: 0,
      billValue: d('sdrReturnAmt'),
      remarks: row.sdrReturnReason as string | null,
      createdBy: actor,
      lines: items.map((i) => {
        const n = (k: string) => num(i[k] as Prisma.Decimal);
        const tax = n('sdriCgstAmt') + n('sdriSgstAmt') + n('sdriIgstAmt') + n('sdriCessAmt');
        return {
          rowNo: i.sdriLineNo as number,
          itemId: i.sdriItemId as string,
          hsnCode: i.sdriHsnCode as string | null,
          unitId: i.sdriItemUnitId as string,
          qty: n('sdriReturnQty'),
          rate: n('sdriRate'),
          discount: n('sdriItemDiscAmt'),
          isService: (i.sdriIsService as boolean) ?? false,
          taxableValue: n('sdriTaxableAmt'),
          taxId: i.sdriTaxId as string | null,
          totalTaxRate: n('sdriTaxPerc'),
          cgstRate: n('sdriCgstPerc'),
          sgstRate: n('sdriSgstPerc'),
          igstRate: n('sdriIgstPerc'),
          cessRate: n('sdriCessPerc'),
          cgstAmount: n('sdriCgstAmt'),
          sgstAmount: n('sdriSgstAmt'),
          igstAmount: n('sdriIgstAmt'),
          cessAmount: n('sdriCessAmt'),
          otherAmount: 0,
          totalValue: round2(n('sdriTaxableAmt') + tax),
          billValue: n('sdriNetAmt') || round2(n('sdriTaxableAmt') + tax),
          taxability: tax > 0 ? 'TAXABLE' : 'EXEMPT',
          supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
        };
      }),
    };
  }

  // ── cancel / transport ───────────────────────────────────────────────────

  async cancel(dto: CancelDcReturnDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdrStatus === 'CANCELLED') {
        return { ...this.keys(dto), sdrStatus: 'CANCELLED' };
      }
      if (row.sdrStatus !== 'POSTED') {
        throwSalesLocked(
          'Only a POSTED DC return can be cancelled — a DRAFT is deleted',
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sdrId',
        );
      }
      const ctx = await this.salesContext.resolve(
        { companyId: row.sdrCompanyId as string, branchId: row.sdrBranchId as string },
        DCR_SPEC.menuId,
        tx,
      );
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }
      const keys = this.store.keysOf(row);
      const docDate = isoDate(row.sdrReturnDate as Date) ?? isoToday();
      await assertAccYearWritable(tx, keys.companyId, keys.accYear, 'sdrAccYear');
      if (await loadDayClosed(tx, keys.companyId, keys.branchId, docDate)) {
        throwSalesLocked(
          `The books for ${docDate} are closed at this branch`,
          SALES_ERROR_CODES.DAY_CLOSED,
          'sdrReturnDate',
        );
      }
      const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
      const { ewbLive } = await loadDeclaredLocks(tx, gdrId);
      if (ewbLive) {
        const gst = await this.blocks.gstRows(tx, gdrId, keys.accYear);
        const w = gst.ewbGeneratedOn
          ? await this.statutory.withinCancelWindow(
              keys.companyId,
              'EWAYBILL',
              gst.ewbGeneratedOn,
              docDate,
              new Date(),
              tx,
            )
          : { within: false };
        if (!w.within) {
          throwSalesLocked(
            "The e-way bill's cancellation window has passed — cancel it at the portal first",
            SALES_ERROR_CODES.EWB_WINDOW_PASSED,
            'posting.ewb',
          );
        }
        await this.gst.cancelEwb({
          gdrId: gdrId!,
          accYear: keys.accYear,
          companyId: keys.companyId,
          reason: dto.reason,
        });
      }
      let reversal: string | null = null;
      if (row.sdrPostedVoucherId) {
        const r = await this.legs.reverseLegs(
          tx,
          row.sdrPostedVoucherId as string,
          keys.accYear,
          dto.reason,
          ctx.actor,
        );
        if (r) {
          const [v] = await tx.$queryRaw<
            { avh_voucher_refno: string | null }[]
          >`SELECT avh_voucher_refno FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
          reversal = v?.avh_voucher_refno ?? null;
        }
      }
      await this.stock.cancel(
        tx,
        {
          docType: 'DC_RETURN',
          docId: keys.id,
          accYear: keys.accYear,
          companyId: keys.companyId,
          branchId: keys.branchId,
          direction: 'IN',
          txnType: 'DC_RETURN',
        },
        ctx.actor,
        dto.reason,
        now,
      );
      if (gdrId) {
        await this.register.cancel(tx, gdrId, keys.accYear, dto.reason, ctx.actor);
      }
      await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
      await this.fulfilment.recompute(
        tx,
        [{ dcId: row.sdrDcId as string, accYear: (row.sdrDcAccYear as string).trim() }],
        ctx.actor,
        now,
      );
      await this.store.trail(
        tx,
        row,
        TxnStatusEvent.CANCELLED,
        'POSTED',
        'CANCELLED',
        ctx.actor,
        now,
        dto.reason,
      );
      await this.store.auditChange(
        tx,
        row,
        'cancel',
        { sdrStatus: 'POSTED' },
        { sdrStatus: 'CANCELLED' },
        ctx.actor,
        `DC return cancelled: ${dto.reason}`,
      );
      return {
        ...this.keys(dto),
        sdrStatus: 'CANCELLED',
        reversalVoucherRefno: reversal,
        cancelledOn: now.toISOString(),
      };
    }, TX);
  }

  async transport(dto: DcReturnTransportDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdrStatus === 'CANCELLED') {
        throwSalesLocked('This DC return is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'sdrId');
      }
      const actor = this.salesContext.actor();
      const gdrId = await this.register.registerIdOf(
        tx,
        row.sdrId as string,
        row.sdrAccYear as string,
      );
      const band = await this.transportBand.write(
        tx,
        {
          docType: 'DC_RETURN',
          docId: row.sdrId as string,
          accYear: row.sdrAccYear as string,
          companyId: row.sdrCompanyId as string,
          branchId: row.sdrBranchId as string,
          tenantId: row.sdrTenantId as string | null,
          docRefno: row.sdrReturnRefno as string,
        },
        { ...dto.transport, direction: 'INWARD' },
        actor,
        { gdrId, now },
      );
      await this.store.trail(
        tx,
        row,
        'TRANSPORT_EDITED',
        row.sdrStatus as string,
        row.sdrStatus as string,
        actor,
        now,
        null,
      );
      return band as unknown as Record<string, unknown>;
    });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
