import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDrCr } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { BillReadService } from '../bill/bill-read.service';
import { DcFulfilmentService } from '../posting/dc-fulfilment.service';
import { DocRegisterService } from '../posting/doc-register.service';
import { GstGatewayService } from '../posting/gst-gateway.service';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { SalesDocStore, type DocKeys, type DocRow, type DocSpec } from '../posting/sales-doc-store';
import { buildCogsLegs } from '../posting/sales-leg.sources';
import { SalesPostingService } from '../posting/sales-posting.service';
import { SalesStockService } from '../posting/sales-stock.service';
import { StatutoryService } from '../posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import {
  assertAccYearWritable,
  assertBandWritable,
  assertSalesmen,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
  refuse,
  warn,
} from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRefusals, throwSalesRight } from '../posting/sales.errors';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type SalesGuardContext,
} from '../posting/types/posting.types';
import type { RegisterDoc } from '../posting/types/doc-register.types';
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
  SDC_DATE_FIELDS,
  SDC_OPTIONAL_FIELDS,
  SDC_SERVER_OWNED,
  type SaveDeliveryChallanDto,
} from './dto/save-delivery-challan.dto';
import { SDI_DATE_FIELDS, SDI_OPTIONAL_FIELDS } from './dto/save-delivery-challan-item.dto';
import type {
  AmendDeliveryChallanDto,
  CancelDeliveryChallanDto,
  ConvertPurposeDto,
  DeliveryChallanKeysDto,
  DeliveryChallanTransportDto,
  PostDeliveryChallanDto,
  ValidateDeliveryChallanDto,
} from './dto/delivery-challan-lifecycle.dto';

/**
 * HANDOVER §4 — `/api/v1/delivery-challans`.
 *
 * A challan moves goods and raises no debt: its posting is the stock movement
 * (DC_ISSUE) plus, under PERPETUAL, the COGS pair on a `DCh` voucher, and a
 * register row for the e-way bill — never an IRN (Q8). Its two lock points
 * are POSTED (lines frozen; the band and the PURPOSE stay open) and EWB
 * GENERATED (everything frozen; cancel only).
 */
export const DC_SPEC: DocSpec = {
  kind: 'DELIVERY_CHALLAN',
  headerDelegate: 'saleDc',
  itemDelegate: 'saleDcItem',
  p: 'sdc',
  ip: 'sdi',
  itemFk: 'sdiDcId',
  refnoField: 'sdcDcRefno',
  slnoField: 'sdcDcSlno',
  dateField: 'sdcDcDate',
  datetimeField: 'sdcDcDatetime',
  custField: 'sdcCustId',
  custNameField: 'sdcCustName',
  revisionField: 'sdcRevisionNo',
  voucherTypeId: SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
  menuId: SALES_MENU_ID.DELIVERY_CHALLAN,
  statusDocType: TxnStatusDocType.DELIVERY_CHALLAN,
  chargeDocType: ChargeDocType.DELIVERY_CHALLAN,
  tenderDocType: null,
  tenderDrCr: TenderDrCr.DR,
  transportDocType: 'DELIVERY_CHALLAN',
  transportDirection: 'OUTWARD',
  tableName: 'sale_dc',
  itemTableName: 'sale_dc_item',
  screenName: 'Delivery Challan',
  optionalFields: SDC_OPTIONAL_FIELDS,
  dateFields: SDC_DATE_FIELDS,
  serverOwned: SDC_SERVER_OWNED,
  itemOptionalFields: SDI_OPTIONAL_FIELDS,
  itemDateFields: SDI_DATE_FIELDS,
  itemRequired: ['sdiItemId', 'sdiItemUnitId', 'sdiGodownId'],
  headerRequired: ['sdcCounterId'],
  headerWhereUnique: 'sdcId_sdcAccYear',
  itemWhereUnique: 'sdiId_sdiAccYear',
};

const TX = { timeout: 60_000, maxWait: 10_000 } as const;

@Injectable()
export class DeliveryChallanService {
  private readonly store: SalesDocStore;

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly statutory: StatutoryService,
    private readonly legs: SalesPostingService,
    private readonly register: DocRegisterService,
    private readonly stock: SalesStockService,
    private readonly blocks: SalesDocBlocksService,
    private readonly transportBand: TransportBandService,
    private readonly fulfilment: DcFulfilmentService,
    private readonly gst: GstGatewayService,
    private readonly billRead: BillReadService,
    audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
  ) {
    this.store = new SalesDocStore(DC_SPEC, audit, charges, tenders, transportBand);
  }

  private keys(dto: DeliveryChallanKeysDto): DocKeys {
    return {
      id: dto.sdcId,
      companyId: dto.sdcCompanyId,
      branchId: dto.sdcBranchId,
      accYear: dto.sdcAccYear,
    };
  }

  // ── §4 create / get / delete ─────────────────────────────────────────────

  async save(dto: SaveDeliveryChallanDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      return this.store.saveDraft(tx, dto as unknown as DocRow, actor, now, {
        beforeWrite: (data) => {
          if (data.sdcDcDatetime === undefined && !data.sdcId) {
            data.sdcDcDatetime = now;
          }
        },
      });
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const row = await this.store.findOrThrow(
      this.prisma as unknown as Prisma.TransactionClient,
      keys,
    );
    return this.payload(this.prisma as unknown as Prisma.TransactionClient, row);
  }

  async delete(dto: DeliveryChallanKeysDto): Promise<{ sdcId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(
      (tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()),
      TX,
    );
    return { sdcId: dto.sdcId, deleted: true };
  }

  async openForBill(q: {
    companyId: string;
    branchId: string;
    partyId: string;
    accYear?: string | null;
  }) {
    return this.billRead.openSources({ ...q, kind: 'DC' });
  }

  private async payload(
    c: Prisma.TransactionClient,
    row: DocRow,
  ): Promise<Record<string, unknown>> {
    const [items, charges, transport, rights, gdrId] = await Promise.all([
      this.store.loadItems(c, row),
      this.store.loadCharges(row),
      this.store.loadTransport(c, row),
      this.salesContext.rights(DC_SPEC.menuId, c),
      this.register.registerIdOf(c, row.sdcId as string, row.sdcAccYear as string),
    ]);
    const { posting, locks } = await this.blocks.build(
      {
        status: row.sdcStatus as string,
        companyId: row.sdcCompanyId as string,
        branchId: row.sdcBranchId as string,
        accYear: row.sdcAccYear as string,
        docDate: isoDate(row.sdcDcDate as Date) ?? isoToday(),
        voucherId: (row.sdcPostedVoucherId as string | null) ?? null,
        registerId: gdrId,
        cogsAmt: num(row.sdcTotalCost as Prisma.Decimal),
      },
      c,
    );
    // A challan's third editable surface: its purpose (§4). False after lock
    // 2, and once any line is billed or returned.
    const touched = items.some(
      (i) =>
        num(i.sdiBilledQty as Prisma.Decimal) > 0 || num(i.sdiReturnedQty as Prisma.Decimal) > 0,
    );
    locks.editable.purpose =
      row.sdcStatus === 'POSTED' && !locks.irnLive && !locks.ewbLive && !touched;
    return {
      ...this.store.plain(row),
      items: items.map((i) => this.store.plain(i)),
      charges,
      transport,
      posting,
      locks,
      rights,
    };
  }

  // ── §4 validate / post ───────────────────────────────────────────────────

  async validate(dto: ValidateDeliveryChallanDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.sdcCompanyId, branchId: dto.sdcBranchId, deviceId: dto.sdcDeviceId },
      DC_SPEC.menuId,
    );
    const g = createGuardContext({
      overrides: dto.overrides ?? [],
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
    });
    const items = (dto.items ?? []).map((i, idx) => ({
      ...(i as unknown as DocRow),
      sdiLineNo: (i.sdiLineNo as number | null) ?? idx + 1,
    }));
    await this.prisma.$transaction(
      (tx) => this.guards(tx, dto as unknown as DocRow, items, ctx, g),
      TX,
    );
    return {
      ok: g.refusals.length === 0,
      refusals: g.refusals,
      warnings: g.warnings,
      rights: ctx.rights,
    };
  }

  async post(dto: PostDeliveryChallanDto): Promise<Record<string, unknown>> {
    let fire: { gdrId: string | null; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdcStatus === 'POSTED') {
        return;
      }
      if (row.sdcStatus === 'CANCELLED') {
        throwSalesLocked('This challan is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
      }
      const ctx = await this.ctxOf(tx, row);
      if (!ctx.rights.post) {
        throwSalesRight('This user may not post on this menu', SALES_ERROR_CODES.RIGHT_POST);
      }
      const items = await this.store.loadItems(tx, row);
      const g = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.guards(tx, row, items, ctx, g);
      if (g.refusals.length > 0) {
        throwSalesRefusals('Challan cannot be posted', g.refusals);
      }
      fire = await this.postCore(tx, row, items, ctx, new Date(), 'DRAFT');
    }, TX);
    if (fire) {
      const f = fire as { gdrId: string | null; ewaybill: boolean };
      this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
    }
    return this.get(this.keys(dto));
  }

  private async ctxOf(tx: Prisma.TransactionClient, row: DocRow): Promise<SalesCallContext> {
    return this.salesContext.resolve(
      {
        companyId: row.sdcCompanyId as string,
        branchId: row.sdcBranchId as string,
        deviceId: row.sdcDeviceId as string | null,
      },
      DC_SPEC.menuId,
      tx,
    );
  }

  private async guards(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
  ): Promise<void> {
    const companyId = row.sdcCompanyId as string;
    const accYear = row.sdcAccYear as string;
    const docDate = isoDate(row.sdcDcDate as Date | string | null) ?? isoToday();
    const today = isoToday();
    await assertAccYearWritable(tx, companyId, accYear, 'sdcAccYear');
    await assertVoucherPartitionExists(tx, accYear, 'sdcAccYear');
    if (docDate > today) {
      refuse(g, SALES_ERROR_CODES.BACKDATE, `A challan cannot be dated ${docDate}, in the future`, {
        field: 'sdcDcDate',
      });
    } else if (docDate !== today && ctx.settings.backdateMode !== 'ALLOW') {
      (ctx.settings.backdateMode === 'REFUSE' ? refuse : warn)(
        g,
        SALES_ERROR_CODES.BACKDATE,
        `This challan is dated ${docDate}, before today`,
        { field: 'sdcDcDate' },
      );
    }
    if (await loadDayClosed(tx, companyId, row.sdcBranchId as string, docDate)) {
      refuse(
        g,
        SALES_ERROR_CODES.DAY_CLOSED,
        `The books for ${docDate} are closed at this branch`,
        { field: 'sdcDcDate' },
      );
    }
    const salesmen = (row.sdcSalesmanId as string[] | null) ?? null;
    await assertSalesmen(tx, companyId, salesmen && salesmen.length ? salesmen : null, {
      field: 'sdcSalesmanId',
    });
    if (!row.sdcCustId) {
      refuse(g, SALES_ERROR_CODES.PAN_REQUIRED, 'A challan must name a customer', {
        field: 'sdcCustId',
      });
    }
    if (items.length === 0) {
      refuse(g, SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A challan with no lines cannot be posted', {
        field: 'items',
      });
    }
    // Purpose — from comp_dc_purposes.
    const [company] = await tx.$queryRaw<
      { comp_dc_purposes: string[] | null; comp_state_code: string | null }[]
    >`
      SELECT comp_dc_purposes, comp_state_code FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    const purpose = ((row.sdcPurpose as string | null) ?? 'SUPPLY').toUpperCase();
    const allowed = company?.comp_dc_purposes ?? ['SUPPLY'];
    if (!allowed.includes(purpose)) {
      refuse(
        g,
        SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED,
        `Purpose ${purpose} is not enabled for this company (allowed: ${allowed.join(', ')})`,
        { field: 'sdcPurpose' },
      );
    }
    // sales.dc_requires_order
    const requiresOrder = (
      (await this.salesContext.setting(
        companyId,
        row.sdcBranchId as string,
        'sales.dc_requires_order',
      )) ?? ''
    )
      .trim()
      .toLowerCase();
    if (
      (requiresOrder === 'true' || requiresOrder === '1') &&
      row.sdcSrcDocType !== 'SALES_ORDER'
    ) {
      refuse(
        g,
        SALES_ERROR_CODES.DC_REQUIRES_ORDER,
        'This company issues challans only against a sales order (sales.dc_requires_order)',
        { field: 'sdcSrcDocId' },
      );
    }
    // Lines against an order may not exceed what is pending.
    const orderLines = items.filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && i.sdiSrcItemId);
    if (orderLines.length > 0) {
      const rows = await tx.$queryRaw<{ soi_id: string; soi_pending_qty: Prisma.Decimal | null }[]>`
        SELECT soi_id, soi_pending_qty FROM sales.sale_order_item WHERE soi_id = ANY(${orderLines.map((l) => l.sdiSrcItemId as string)}::uuid[])`;
      const by = new Map(rows.map((r) => [r.soi_id, num(r.soi_pending_qty)]));
      const taken = new Map<string, number>();
      for (const l of orderLines) {
        const k = l.sdiSrcItemId as string;
        taken.set(k, (taken.get(k) ?? 0) + num(l.sdiDcQty as Prisma.Decimal));
      }
      for (const [k, qty] of taken) {
        const pending = by.get(k);
        if (pending === undefined) {
          refuse(g, SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line ${k} does not exist`, {
            field: 'items',
          });
        } else if (qty > pending + 0.0005) {
          (ctx.settings.allowBillOverOrderQty ? warn : refuse)(
            g,
            SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
            `Order line has ${pending} pending; this challan takes ${qty}`,
            { field: 'items' },
          );
        }
      }
    }
    // E-way bill applicability against the band.
    const inter =
      supplyNatureOf(company?.comp_state_code, row.sdcPosStcd as string | null) === 'INTER';
    const eway = await this.statutory.ewayApplicable(
      companyId,
      num(row.sdcDcAmt as Prisma.Decimal),
      docDate,
      { interState: inter, stateCode: row.sdcPosStcd as string | null },
      tx,
    );
    if (eway.applicable && row.sdcId) {
      const band = await this.store.loadTransport(tx, row);
      if (!band || (!band.transporterId && !band.transporterName && !band.lrNo)) {
        warn(
          g,
          SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING,
          `An e-way bill is required for this consignment (${num(row.sdcDcAmt as Prisma.Decimal)} ${inter ? 'inter' : 'intra'}-state) and the transport band is empty`,
          { field: 'transport' },
        );
      }
    }
  }

  private async postCore(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    now: Date,
    fromStatus: string,
    revisionNo?: number,
  ): Promise<{ gdrId: string | null; ewaybill: boolean }> {
    const actor = ctx.actor;
    const keys = this.store.keysOf(row);
    const refno = (row.sdcDcRefno as string) ?? keys.id;
    const docDate = isoDate(row.sdcDcDate as Date) ?? isoToday();
    const moving = items.filter(
      (i) =>
        !(i.sdiIsService as boolean) &&
        num(i.sdiDcQty as Prisma.Decimal) + num(i.sdiFreeQty as Prisma.Decimal) > 0,
    );

    // 1 · the goods leave (DC_ISSUE).
    const stock = await this.stock.post(
      tx,
      {
        docType: 'DELIVERY_CHALLAN',
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        tenantId: row.sdcTenantId as string | null,
        deviceId: row.sdcDeviceId as string | null,
        sessionId: row.sdcSessionId as string | null,
        docDate,
        docDatetime: (row.sdcDcDatetime as Date | null) ?? now,
        refno,
        revision: revisionNo ?? (row.sdcRevisionNo as number) ?? 1,
        partyId: row.sdcCustId as string | null,
        direction: 'OUT',
        txnType: 'DC_ISSUE',
        lines: moving.map((i) => ({
          lineId: i.sdiId as string,
          lineNo: i.sdiLineNo as number,
          itemId: i.sdiItemId as string,
          itemUnitId: i.sdiItemUnitId as string,
          godownId: i.sdiGodownId as string,
          lotId: i.sdiLotId as string | null,
          bucket: i.sdiBucket as string | null,
          qty: num(i.sdiDcQty as Prisma.Decimal),
          freeQty: num(i.sdiFreeQty as Prisma.Decimal),
          weightQty: i.sdiWeightQty === null ? null : num(i.sdiWeightQty as Prisma.Decimal),
          toBaseFactor: num(i.sdiToBaseFactor as Prisma.Decimal) || null,
          batchNo: i.sdiBatchNo as string | null,
          batchDate: isoDate(i.sdiBatchDate as Date | null),
          expiryDate: isoDate(i.sdiExpiryDate as Date | null),
          serialNo: i.sdiSerialNo as string | null,
          mrp: i.sdiMaxPrice === null ? null : num(i.sdiMaxPrice as Prisma.Decimal),
          rate: num(i.sdiRate as Prisma.Decimal),
          taxPerc: num(i.sdiTaxPerc as Prisma.Decimal),
        })),
      },
      actor,
      now,
    );
    for (const i of moving) {
      await this.store.updateItem(tx, i, {
        sdiCostPrice: new Prisma.Decimal((stock.costByLine.get(i.sdiId as string) ?? 0).toFixed(2)),
        sdiLotId: stock.lotByLine.get(i.sdiId as string) ?? i.sdiLotId ?? null,
      });
    }

    // 2 · the COGS pair, under PERPETUAL only (null voucher under PERIODIC).
    let voucherId: string | null = null;
    let voucherLastNo: bigint | null = null;
    const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
    if (cogs > 0 && row.sdcCustId) {
      const v = await this.legs.postLegs(tx, {
        header: {
          companyId: keys.companyId,
          branchId: keys.branchId,
          tenantId: row.sdcTenantId as string | null,
          accYear: keys.accYear,
          voucherTypeId: SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
          voucherDate: docDate,
          srcModule: 'SALES',
          srcDocType: 'DELIVERY_CHALLAN',
          srcDocId: keys.id,
          docRefno: refno,
          docDate,
          usrRefno: row.sdcUsrRefno as string | null,
          docAmount: num(row.sdcDcAmt as Prisma.Decimal),
          partyId: row.sdcCustId as string,
          userId: isUuid(row.sdcUserId as string) ? (row.sdcUserId as string) : actor,
          sessionId: row.sdcSessionId as string | null,
          deviceType: row.sdcDeviceType as string | null,
          remarks: row.sdcRemarks as string | null,
          createdBy: actor,
          presetRefno: row.sdcDcRefno as string,
          presetNo: row.sdcDcSlno as bigint | null,
        },
        legs: buildCogsLegs(cogs, 'ISSUE'),
      });
      voucherId = v.voucherId;
      voucherLastNo = v.voucherLastNo;
    }

    // 3 · the register — e-way bill only, never an IRN.
    const [company] = await tx.$queryRaw<
      { comp_state_code: string | null }[]
    >`SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
    const nature = supplyNatureOf(company?.comp_state_code, row.sdcPosStcd as string | null);
    let gdrId: string | null = null;
    let ewaybill = false;
    if (row.sdcCustId) {
      const reg = await this.register.write(
        tx,
        this.registerDoc(row, items, voucherId, voucherLastNo, nature, actor),
        { interState: nature === 'INTER' },
      );
      gdrId = reg.gdrId;
      ewaybill = reg.ewaybillApplicable;
    }

    // 4 · the header, status last.
    await this.store.setStatus(
      tx,
      row,
      'POSTED',
      {
        sdcPostedVoucherId: voucherId,
        sdcTotalCost: new Prisma.Decimal(stock.cogsTotal.toFixed(2)),
        ...(revisionNo ? { sdcRevisionNo: revisionNo } : {}),
      },
      actor,
      now,
    );
    await this.fulfilment.recompute(tx, [{ dcId: keys.id, accYear: keys.accYear }], actor, now);
    await this.store.trail(
      tx,
      row,
      TxnStatusEvent.POSTED,
      fromStatus,
      'POSTED',
      actor,
      now,
      revisionNo ? `Re-posted as revision ${revisionNo}` : null,
    );
    await this.store.auditChange(
      tx,
      row,
      'approve',
      { sdcStatus: fromStatus },
      { sdcStatus: 'POSTED', sdcPostedVoucherId: voucherId, gdrId, cogs },
      actor,
      'Challan posted',
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
      companyId: row.sdcCompanyId as string,
      branchId: row.sdcBranchId as string,
      accYear: row.sdcAccYear as string,
      // A PERIODIC challan has no voucher; the register still needs one to key
      // on, so the (non-null) column takes the challan's own id and number.
      voucherId: voucherId ?? (row.sdcId as string),
      voucherTypeId: SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
      voucherNo:
        (row.sdcDcSlno as bigint | null) ??
        voucherNo ??
        numericTail(row.sdcDcRefno as string, BigInt(0)),
      voucherDate: isoDate(row.sdcDcDate as Date)!,
      voucherRefno: row.sdcDcRefno as string,
      sourceDocId: row.sdcId as string,
      docType: 'DELIVERY_CHALLAN',
      tranNature: 'DELIVERY_CHALLAN',
      docFlow: 'OUTWARD',
      docSign: 1,
      docNo: row.sdcDcRefno as string,
      docDate: isoDate(row.sdcDcDate as Date)!,
      docRefNo: row.sdcUsrRefno as string | null,
      taxability: d('sdcTaxAmt') > 0 ? 'TAXABLE' : 'EXEMPT',
      supplyClass: 'GOODS',
      supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      placeOfSupplyCode: row.sdcPosStcd as string | null,
      placeOfSupplyName: row.sdcStateName as string | null,
      partyId: row.sdcCustId as string,
      partyName: row.sdcCustName as string | null,
      partyAddr1: row.sdcCustAddr as string | null,
      partyLocation: row.sdcCustPlace as string | null,
      partyPin: row.sdcCustPin as string | null,
      partyStateCode: row.sdcCustStcd as string | null,
      partyStateName: row.sdcStateName as string | null,
      partyGstType: row.sdcCustGstType as string | null,
      partyGstin: ((row.sdcCustGstin as string | null) ?? '').trim() || null,
      grossValue: d('sdcGrossAmt'),
      discountValue: d('sdcDiscAmt'),
      taxableValue: d('sdcTaxableAmt'),
      cgstValue: d('sdcCgstAmt'),
      sgstValue: d('sdcSgstAmt'),
      igstValue: d('sdcIgstAmt'),
      cessValue: d('sdcCessAmt'),
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: d('sdcOtherAmt'),
      roundOff: d('sdcRoundOff'),
      billValue: d('sdcDcAmt'),
      remarks: typeof row.sdcPurpose === 'string' ? row.sdcPurpose : null,
      createdBy: actor,
      lines: items.map((i) => {
        const n = (k: string) => num(i[k] as Prisma.Decimal);
        const tax = n('sdiCgstAmt') + n('sdiSgstAmt') + n('sdiIgstAmt') + n('sdiCessAmt');
        return {
          rowNo: i.sdiLineNo as number,
          itemId: i.sdiItemId as string,
          hsnCode: i.sdiHsnCode as string | null,
          unitId: i.sdiItemUnitId as string,
          qty: n('sdiDcQty'),
          rate: n('sdiRate'),
          discount: n('sdiDiscAmt'),
          isService: (i.sdiIsService as boolean) ?? false,
          taxableValue: n('sdiTaxableAmt'),
          taxId: i.sdiTaxId as string | null,
          totalTaxRate: n('sdiTaxPerc'),
          cgstRate: n('sdiCgstPerc'),
          sgstRate: n('sdiSgstPerc'),
          igstRate: n('sdiIgstPerc'),
          cessRate: n('sdiCessPerc'),
          cgstAmount: n('sdiCgstAmt'),
          sgstAmount: n('sdiSgstAmt'),
          igstAmount: n('sdiIgstAmt'),
          cessAmount: n('sdiCessAmt'),
          otherAmount: 0,
          totalValue: round2(n('sdiTaxableAmt') + tax),
          billValue: n('sdiNetAmt') || round2(n('sdiTaxableAmt') + tax),
          taxability: tax > 0 ? 'TAXABLE' : 'EXEMPT',
          supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
        };
      }),
    };
  }

  // ── §4 cancel / amend ────────────────────────────────────────────────────

  async cancel(dto: CancelDeliveryChallanDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdcStatus === 'CANCELLED') {
        return {
          ...this.keys(dto),
          sdcStatus: 'CANCELLED',
          cancelledOn: (row.sdcModifiedOn as Date | null)?.toISOString() ?? null,
        };
      }
      if (row.sdcStatus !== 'POSTED') {
        throwSalesLocked(
          'Only a POSTED challan can be cancelled — a DRAFT is deleted',
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sdcId',
        );
      }
      const ctx = await this.ctxOf(tx, row);
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }
      const items = await this.store.loadItems(tx, row);
      await this.assertUnwindable(tx, row, items, dto.reason);
      const reversal = await this.unwind(tx, row, ctx.actor, dto.reason, now);
      await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
      await this.fulfilment.recompute(
        tx,
        [{ dcId: row.sdcId as string, accYear: row.sdcAccYear as string }],
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
        { sdcStatus: 'POSTED' },
        { sdcStatus: 'CANCELLED' },
        ctx.actor,
        `Challan cancelled: ${dto.reason}`,
      );
      return {
        ...this.keys(dto),
        sdcStatus: 'CANCELLED',
        reversalVoucherRefno: reversal,
        cancelledOn: now.toISOString(),
      };
    }, TX);
  }

  async amend(dto: AmendDeliveryChallanDto): Promise<Record<string, unknown>> {
    const now = new Date();
    let fire: { gdrId: string | null; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const keys: DocKeys = {
        id: dto.sdcId,
        companyId: dto.sdcCompanyId,
        branchId: dto.sdcBranchId,
        accYear: dto.sdcAccYear,
      };
      const row = await this.store.lock(tx, keys);
      if (row.sdcStatus !== 'POSTED') {
        throwSalesLocked(
          row.sdcStatus === 'CANCELLED'
            ? 'This challan is CANCELLED'
            : 'This challan is a DRAFT — use /create',
          row.sdcStatus === 'CANCELLED'
            ? SALES_ERROR_CODES.DOC_CANCELLED
            : SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sdcId',
        );
      }
      const ctx = await this.ctxOf(tx, row);
      if (!ctx.rights.amend) {
        throwSalesRight('This user may not amend on this menu', SALES_ERROR_CODES.RIGHT_AMEND);
      }
      if (!ctx.settings.allowPostedAmend) {
        throwSalesLocked(
          'Amending a posted document is switched off (sales.allow_posted_amend)',
          SALES_ERROR_CODES.AMEND_OFF,
          'sdcId',
        );
      }
      if ((row.sdcRevisionNo as number) !== dto.baseRevision) {
        throwSalesLocked(
          `This challan has been amended since you opened it (now revision ${String(row.sdcRevisionNo)}, you sent ${dto.baseRevision})`,
          SALES_ERROR_CODES.REVISION_STALE,
          'baseRevision',
        );
      }
      const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
      const { ewbLive } = await loadDeclaredLocks(tx, gdrId);
      if (ewbLive) {
        throwSalesLocked(
          'This challan has a live e-way bill and cannot be amended — cancel it and raise a fresh one',
          SALES_ERROR_CODES.EWB_LIVE,
          'sdcId',
        );
      }
      const items = await this.store.loadItems(tx, row);
      await this.assertUnwindable(tx, row, items, dto.editRemark);
      const before = this.store.plain(row);
      await this.unwind(tx, row, ctx.actor, `Amended: ${dto.editRemark}`, now);
      const draft = await this.store.setStatus(
        tx,
        row,
        'DRAFT',
        { sdcPostedVoucherId: null },
        ctx.actor,
        now,
      );
      await this.store.trail(
        tx,
        draft,
        TxnStatusEvent.AMENDED,
        'POSTED',
        'DRAFT',
        ctx.actor,
        now,
        dto.editRemark,
      );
      const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
      void _b;
      void _e;
      void _o;
      const saved = await this.store.saveDraft(
        tx,
        { ...(saveDto as unknown as DocRow), sdcId: keys.id },
        ctx.actor,
        now,
      );
      const newItems = await this.store.loadItems(tx, saved);
      const g = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.guards(tx, saved, newItems, ctx, g);
      if (g.refusals.length > 0) {
        throwSalesRefusals('Challan cannot be amended', g.refusals);
      }
      fire = await this.postCore(
        tx,
        saved,
        newItems,
        ctx,
        now,
        'DRAFT',
        (row.sdcRevisionNo as number) + 1,
      );
      await this.store.auditChange(
        tx,
        saved,
        'update',
        before,
        this.store.plain(saved),
        ctx.actor,
        `Challan amended to revision ${(row.sdcRevisionNo as number) + 1}: ${dto.editRemark}`,
      );
    }, TX);
    if (fire) {
      const f = fire as { gdrId: string | null; ewaybill: boolean };
      this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
    }
    return this.get({
      id: dto.sdcId,
      companyId: dto.sdcCompanyId,
      branchId: dto.sdcBranchId,
      accYear: dto.sdcAccYear,
    });
  }

  private async assertUnwindable(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    reason: string,
  ): Promise<void> {
    const keys = this.store.keysOf(row);
    const docDate = isoDate(row.sdcDcDate as Date) ?? isoToday();
    await assertAccYearWritable(tx, keys.companyId, keys.accYear, 'sdcAccYear');
    if (await loadDayClosed(tx, keys.companyId, keys.branchId, docDate)) {
      throwSalesLocked(
        `The books for ${docDate} are closed at this branch`,
        SALES_ERROR_CODES.DAY_CLOSED,
        'sdcDcDate',
      );
    }
    if (items.some((i) => num(i.sdiBilledQty as Prisma.Decimal) > 0)) {
      throwSalesLocked(
        'A bill has been raised against this challan — cancel the bill first',
        SALES_ERROR_CODES.DC_BILLED,
        'sdcId',
      );
    }
    if (items.some((i) => num(i.sdiReturnedQty as Prisma.Decimal) > 0)) {
      throwSalesLocked(
        'Goods have been returned against this challan — cancel the DC return first',
        SALES_ERROR_CODES.DC_RETURNED,
        'sdcId',
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
          "The e-way bill's cancellation window has passed — cancel it at the portal or let it expire first",
          SALES_ERROR_CODES.EWB_WINDOW_PASSED,
          'posting.ewb',
        );
      }
      await this.gst.cancelEwb({
        gdrId: gdrId!,
        accYear: keys.accYear,
        companyId: keys.companyId,
        reason,
      });
    }
  }

  private async unwind(
    tx: Prisma.TransactionClient,
    row: DocRow,
    actor: string,
    reason: string,
    now: Date,
  ): Promise<string | null> {
    const keys = this.store.keysOf(row);
    let reversalRefno: string | null = null;
    if (row.sdcPostedVoucherId) {
      const r = await this.legs.reverseLegs(
        tx,
        row.sdcPostedVoucherId as string,
        keys.accYear,
        reason,
        actor,
      );
      if (r) {
        const [v] = await tx.$queryRaw<
          { avh_voucher_refno: string | null }[]
        >`SELECT avh_voucher_refno FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
        reversalRefno = v?.avh_voucher_refno ?? null;
      }
    }
    await this.stock.cancel(
      tx,
      {
        docType: 'DELIVERY_CHALLAN',
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        direction: 'OUT',
        txnType: 'DC_ISSUE',
      },
      actor,
      reason,
      now,
    );
    const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
    if (gdrId) {
      await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
    }
    return reversalRefno;
  }

  // ── §4 convert-purpose / transport ───────────────────────────────────────

  async convertPurpose(dto: ConvertPurposeDto): Promise<Record<string, unknown>> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdcStatus !== 'POSTED') {
        throwSalesLocked(
          'Only a POSTED challan changes purpose — edit a DRAFT directly',
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sdcId',
        );
      }
      const ctx = await this.ctxOf(tx, row);
      const gdrId = await this.register.registerIdOf(
        tx,
        row.sdcId as string,
        row.sdcAccYear as string,
      );
      // The purpose became the e-way bill's sub-supply type: declared, locked.
      await assertBandWritable(tx, gdrId);
      const items = await this.store.loadItems(tx, row);
      if (
        items.some(
          (i) =>
            num(i.sdiBilledQty as Prisma.Decimal) > 0 ||
            num(i.sdiReturnedQty as Prisma.Decimal) > 0,
        )
      ) {
        throwSalesLocked(
          'This challan has been billed or returned against — its purpose decided what those became',
          SALES_ERROR_CODES.DC_BILLED,
          'purpose',
        );
      }
      const [company] = await tx.$queryRaw<
        { comp_dc_purposes: string[] | null }[]
      >`SELECT comp_dc_purposes FROM public.companys WHERE comp_id = ${row.sdcCompanyId as string}::uuid`;
      if (!(company?.comp_dc_purposes ?? ['SUPPLY']).includes(dto.purpose)) {
        throwSalesLocked(
          `Purpose ${dto.purpose} is not enabled for this company`,
          SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED,
          'purpose',
        );
      }
      const from = row.sdcPurpose as string;
      await this.store.setStatus(tx, row, 'POSTED', { sdcPurpose: dto.purpose }, ctx.actor, now);
      await this.store.trail(
        tx,
        row,
        'PURPOSE_CONVERTED',
        'POSTED',
        'POSTED',
        ctx.actor,
        now,
        `${from} → ${dto.purpose}: ${dto.remark}`,
      );
      await this.store.auditChange(
        tx,
        row,
        'update',
        { sdcPurpose: from },
        { sdcPurpose: dto.purpose },
        ctx.actor,
        `Purpose converted: ${dto.remark}`,
      );
    }, TX);
    return this.get(this.keys(dto));
  }

  async transport(dto: DeliveryChallanTransportDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdcStatus === 'CANCELLED') {
        throwSalesLocked('This challan is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
      }
      const actor = this.salesContext.actor();
      const gdrId = await this.register.registerIdOf(
        tx,
        row.sdcId as string,
        row.sdcAccYear as string,
      );
      const band = await this.transportBand.write(
        tx,
        {
          docType: 'DELIVERY_CHALLAN',
          docId: row.sdcId as string,
          accYear: row.sdcAccYear as string,
          companyId: row.sdcCompanyId as string,
          branchId: row.sdcBranchId as string,
          tenantId: row.sdcTenantId as string | null,
          docRefno: row.sdcDcRefno as string,
        },
        dto.transport,
        actor,
        { gdrId, now },
      );
      await this.store.trail(
        tx,
        row,
        'TRANSPORT_EDITED',
        row.sdcStatus as string,
        row.sdcStatus as string,
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
