import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import {
  TenderDrCr,
  TenderSrcDocType,
} from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { syncBillAdjustments } from '../../../common/posting/bill-adjustment.helper';
import type { SaveBillAdjustmentDto } from '../bill/dto/save-bill-adjustment.dto';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { GstGatewayService } from '../posting/gst-gateway.service';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { PromotionUsageService } from '../posting/promotion-usage.service';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { SalesDocStore, type DocKeys, type DocRow, type DocSpec } from '../posting/sales-doc-store';
import { buildReturnLegs } from '../posting/sales-leg.sources';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { SalesStockService } from '../posting/sales-stock.service';
import { StatutoryService } from '../../../common/posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import {
  assertAccYearWritable,
  assertAmendable,
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
import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
import {
  SALES_MENU_ID,
  SALES_VOUCHER_TYPE,
  TENDER_TYPE,
  bucketTaxes,
  daysBetween,
  isoDate,
  isoToday,
  num,
  numericTail,
  round2,
  supplyNatureOf,
} from '../posting/sales-doc.utils';
import {
  SR_DATE_FIELDS,
  SR_OPTIONAL_FIELDS,
  SR_SERVER_OWNED,
  type SaveSaleReturnDto,
} from './dto/save-sale-return.dto';
import { SRI_DATE_FIELDS, SRI_OPTIONAL_FIELDS } from './dto/save-sale-return-item.dto';
import type {
  AmendSaleReturnDto,
  CancelSaleReturnDto,
  PostSaleReturnDto,
  SaleReturnKeysDto,
  SaleReturnTransportDto,
  ValidateSaleReturnDto,
} from './dto/sale-return-lifecycle.dto';

/**
 * HANDOVER §6 — `/api/v1/sale-returns`: the credit note.
 *
 * The bill's mirror: goods IN (SALE_RETURN, bucket by condition), the return
 * legs on an `SRt` voucher, a CREDIT_NOTE register row (`DocDtls.Typ` CRN,
 * sign −1), a CR balance row the customer can spend, and one of three
 * settlements — CASH refunds it through the tenders, ADJUST sets it off against
 * the original bill, ADVANCE leaves it open. The loyalty the returned portion
 * earned is clawed back; the promotion benefit it took is reported.
 */
export const SR_SPEC: DocSpec = {
  kind: 'SALE_RETURN',
  headerDelegate: 'saleReturn',
  itemDelegate: 'saleReturnItem',
  p: 'sr',
  ip: 'sri',
  itemFk: 'sriReturnId',
  refnoField: 'srReturnRefno',
  slnoField: 'srReturnSlno',
  dateField: 'srReturnDate',
  datetimeField: 'srReturnDatetime',
  custField: 'srCustId',
  custNameField: 'srCustName',
  revisionField: 'srRevisionNo',
  voucherTypeId: SALES_VOUCHER_TYPE.SALE_RETURN,
  menuId: SALES_MENU_ID.SALE_RETURN,
  statusDocType: TxnStatusDocType.SALE_RETURN,
  chargeDocType: ChargeDocType.SALE_RETURN,
  tenderDocType: TenderSrcDocType.SALE_RETURN,
  tenderDrCr: TenderDrCr.CR,
  transportDocType: 'SALE_RETURN',
  transportDirection: 'INWARD',
  tableName: 'sale_return',
  itemTableName: 'sale_return_item',
  screenName: 'Sale Return',
  optionalFields: SR_OPTIONAL_FIELDS,
  dateFields: SR_DATE_FIELDS,
  serverOwned: SR_SERVER_OWNED,
  itemOptionalFields: SRI_OPTIONAL_FIELDS,
  itemDateFields: SRI_DATE_FIELDS,
  itemRequired: ['sriItemId', 'sriItemUnitId', 'sriGodownId'],
  headerRequired: ['srCounterId'],
  itemDefaults: (h) => ({ sriPriceLevel: (h.srPriceLevel as number | null) ?? 1 }),
  headerWhereUnique: 'srId_srAccYear',
  itemWhereUnique: 'sriId_sriAccYear',
};

const BUCKET_BY_CONDITION: Record<string, string> = {
  RESTOCK: 'SALEABLE',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  SCRAP: 'QUARANTINE',
};
const TX = { timeout: 60_000, maxWait: 10_000 } as const;

interface BillRow {
  sb_id: string;
  sb_acc_year: string;
  sb_status: string;
  sb_bill_refno: string | null;
  sb_bill_date: Date;
  sb_bill_amt: Prisma.Decimal;
  sb_taxable_amt: Prisma.Decimal;
  sb_cust_id: string | null;
  sb_loyalty_member_id: string | null;
  sb_loyalty_earn_points: Prisma.Decimal;
  sb_returned_amt: Prisma.Decimal;
}

@Injectable()
export class SaleReturnService {
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
    private readonly loyalty: LoyaltyLedgerService,
    private readonly promo: PromotionUsageService,
    private readonly gst: GstGatewayService,
    audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
  ) {
    this.store = new SalesDocStore(SR_SPEC, audit, charges, tenders, transportBand);
  }

  private keys(dto: SaleReturnKeysDto): DocKeys {
    return {
      id: dto.srId,
      companyId: dto.srCompanyId,
      branchId: dto.srBranchId,
      accYear: dto.srAccYear,
    };
  }

  // ── create / get / delete / bill-lines ───────────────────────────────────

  async save(dto: SaveSaleReturnDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const body: DocRow = { ...(dto as unknown as DocRow) };
      if (dto.srIsAgainstBill !== false && dto.srBillId && dto.srBillAccYear) {
        const bill = await this.bill(tx, dto.srBillId, dto.srBillAccYear);
        if (bill) {
          body.srIsAgainstBill = true;
          body.srBillRefno = body.srBillRefno ?? bill.sb_bill_refno;
          body.srBillDate = body.srBillDate ?? isoDate(bill.sb_bill_date);
          body.srCustId = body.srCustId ?? bill.sb_cust_id;
        }
      }
      return this.store.saveDraft(tx, body, actor, now, {
        beforeWrite: (data) => {
          if (data.srReturnDatetime === undefined) {
            data.srReturnDatetime = now;
          }
        },
      });
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const row = await this.store.findOrThrow(c, keys);
    const [items, charges, tenders, transport, rights, gdrId, cnApplied] = await Promise.all([
      this.store.loadItems(c, row),
      this.store.loadCharges(row),
      this.store.loadTenders(row),
      this.store.loadTransport(c, row),
      this.salesContext.rights(SR_SPEC.menuId, c),
      this.register.registerIdOf(c, keys.id, keys.accYear),
      this.creditApplied(c, row),
    ]);
    const { posting, locks } = await this.blocks.build(
      {
        status: row.srStatus as string,
        companyId: keys.companyId,
        branchId: keys.branchId,
        accYear: keys.accYear,
        docDate: isoDate(row.srReturnDate as Date) ?? isoToday(),
        voucherId: (row.srPostedVoucherId as string | null) ?? null,
        registerId: gdrId,
        cogsAmt: num(row.srTotalCost as Prisma.Decimal),
        allocations: cnApplied,
      },
      c,
    );
    return {
      ...this.store.plain(row),
      items: items.map((i) => this.store.plain(i)),
      charges,
      tenders,
      transport,
      posting: {
        ...posting,
        settlement: {
          refunded: num(row.srRefundAmt as Prisma.Decimal),
          adjusted: num(row.srAdjustedAmt as Prisma.Decimal),
          credited: num(row.srCreditAmt as Prisma.Decimal),
          adjustedBills: await this.adjustedBills(c, row),
        },
        loyaltyReversed: num(row.srLoyaltyReversePoints as Prisma.Decimal),
        promoClawback: num(row.srPromoClawbackAmt as Prisma.Decimal),
      },
      locks,
      rights,
    };
  }

  async delete(dto: SaleReturnKeysDto): Promise<{ srId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(
      (tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()),
      TX,
    );
    return { srId: dto.srId, deleted: true };
  }

  /** §6 — `GET /sale-returns/bill-lines?sbId&sbAccYear`. */
  async billLines(sbId: string, sbAccYear: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT b.sbi_id AS "billItemId", b.sbi_line_no AS "lineNo", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             b.sbi_item_id AS "itemId", b.sbi_item_unit_id AS "itemUnitId", b.sbi_godown_id AS "godownId",
             b.sbi_bill_qty AS "billQty",
             COALESCE((SELECT SUM(r.sri_return_qty + r.sri_free_qty) FROM sales.sale_return_item r
                         JOIN sales.sale_return h ON h.sr_id = r.sri_return_id AND h.sr_acc_year = r.sri_acc_year
                        WHERE r.sri_bill_item_id = b.sbi_id AND r.sri_is_deleted = false AND h.sr_is_deleted = false
                          AND h.sr_status = 'POSTED'), 0) AS "returnedQty",
             im.item_allow_sales_return AS "returnable",
             b.sbi_is_free AS "isFree", b.sbi_free_type AS "freeType", b.sbi_lot_id AS "lotId", b.sbi_batch_no AS "batchNo",
             b.sbi_rate AS "rate", b.sbi_tax_perc AS "taxPerc", b.sbi_tax_id AS "taxId", b.sbi_hsn_code AS "hsnCode",
             b.sbi_cogs_amt AS "cost", b.sbi_scheme_id AS "schemeId", b.sbi_taxable_amt AS "taxableAmt"
        FROM sales.sale_bill_item b
        JOIN inventory.item_master im ON im.item_id = b.sbi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE b.sbi_bill_id = ${sbId}::uuid AND b.sbi_acc_year = ${sbAccYear}::char(9) AND b.sbi_is_deleted = false
       ORDER BY b.sbi_line_no`;
    return rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v instanceof Prisma.Decimal ? Number(v.toString()) : v,
        ]),
      ),
    );
  }

  // ── validate / post ──────────────────────────────────────────────────────

  async validate(dto: ValidateSaleReturnDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.srCompanyId, branchId: dto.srBranchId, deviceId: dto.srDeviceId },
      SR_SPEC.menuId,
    );
    const g = createGuardContext({
      overrides: dto.overrides ?? [],
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
      dryRun: true,
    });
    const items = (dto.items ?? []).map((i, idx) => ({
      ...(i as unknown as DocRow),
      sriLineNo: (i.sriLineNo as number | null) ?? idx + 1,
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

  async post(dto: PostSaleReturnDto): Promise<Record<string, unknown>> {
    let fire: { gdrId: string | null; einvoice: boolean; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.srStatus === 'POSTED') {
        return;
      }
      if (row.srStatus === 'CANCELLED') {
        throwSalesLocked('This sale return is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'srId');
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
        throwSalesRefusals('Sale return cannot be posted', g.refusals);
      }
      fire = await this.postCore(tx, row, items, ctx, new Date(), 'DRAFT');
    }, TX);
    if (fire) {
      this.gst.enqueueAfterPost(
        fire as { gdrId: string | null; einvoice: boolean; ewaybill: boolean },
      );
    }
    return this.get(this.keys(dto));
  }

  private async ctxOf(tx: Prisma.TransactionClient, row: DocRow): Promise<SalesCallContext> {
    return this.salesContext.resolve(
      {
        companyId: row.srCompanyId as string,
        branchId: row.srBranchId as string,
        deviceId: row.srDeviceId as string | null,
      },
      SR_SPEC.menuId,
      tx,
    );
  }

  private async bill(
    tx: Prisma.TransactionClient,
    sbId: string,
    sbAccYear: string,
  ): Promise<BillRow | null> {
    const [b] = await tx.$queryRaw<BillRow[]>`
      SELECT sb_id, sb_acc_year, sb_status, sb_bill_refno, sb_bill_date, sb_bill_amt, sb_taxable_amt, sb_cust_id,
             sb_loyalty_member_id, sb_loyalty_earn_points, sb_returned_amt
        FROM sales.sale_bill WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${sbAccYear}::char(9) AND sb_is_deleted = false`;
    return b ?? null;
  }

  private async guards(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
  ): Promise<void> {
    const companyId = row.srCompanyId as string;
    const branchId = row.srBranchId as string;
    const accYear = row.srAccYear as string;
    const docDate = isoDate(row.srReturnDate as Date | string | null) ?? isoToday();
    const today = isoToday();
    await assertAccYearWritable(tx, companyId, accYear, 'srAccYear');
    await assertVoucherPartitionExists(tx, accYear, 'srAccYear');
    if (docDate > today) {
      refuse(g, SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
        field: 'srReturnDate',
      });
    } else if (docDate !== today && ctx.settings.backdateMode !== 'ALLOW') {
      (ctx.settings.backdateMode === 'REFUSE' ? refuse : warn)(
        g,
        SALES_ERROR_CODES.BACKDATE,
        `This return is dated ${docDate}, before today`,
        { field: 'srReturnDate' },
      );
    }
    if (await loadDayClosed(tx, companyId, branchId, docDate)) {
      refuse(
        g,
        SALES_ERROR_CODES.DAY_CLOSED,
        `The books for ${docDate} are closed at this branch`,
        { field: 'srReturnDate' },
      );
    }
    const salesmen = (row.srSalesmanId as string[] | null) ?? null;
    await assertSalesmen(tx, companyId, salesmen && salesmen.length ? salesmen : null, {
      field: 'srSalesmanId',
    });
    if (!row.srCustId) {
      refuse(
        g,
        SALES_ERROR_CODES.PAN_REQUIRED,
        'A sale return must name a customer — the credit note is raised against the customer ledger',
        { field: 'srCustId' },
      );
    }
    if (items.length === 0) {
      refuse(g, SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A return with no lines cannot be posted', {
        field: 'items',
      });
    }
    const mode = ((row.srSettleMode as string | null) ?? 'ADJUST').toUpperCase();
    if (!['CASH', 'ADJUST', 'ADVANCE'].includes(mode)) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `srSettleMode must be CASH, ADJUST or ADVANCE (got ${mode})`,
        { field: 'srSettleMode' },
      );
    }

    // Items: allowed to return, free lines, quantities against the bill.
    const itemIds = [...new Set(items.map((i) => i.sriItemId as string))];
    const masters = itemIds.length
      ? await tx.$queryRaw<
          { item_id: string; item_allow_sales_return: boolean; item_name_en: string }[]
        >`
          SELECT item_id, item_allow_sales_return, item_name_en FROM inventory.item_master WHERE item_id = ANY(${itemIds}::uuid[])`
      : [];
    const allow = new Map(masters.map((m) => [m.item_id, m]));
    for (const i of items) {
      const m = allow.get(i.sriItemId as string);
      if (m && !m.item_allow_sales_return) {
        refuse(
          g,
          SALES_ERROR_CODES.RETURN_ITEM_NOT_ALLOWED,
          `Line ${String(i.sriLineNo)}: ${m.item_name_en} does not accept sales returns`,
          { field: 'items', line: i.sriLineNo as number },
        );
      }
      if ((i.sriIsFree as boolean) && !ctx.settings.freeReturnAllowed) {
        refuse(
          g,
          SALES_ERROR_CODES.FREE_RETURN_OFF,
          `Line ${String(i.sriLineNo)}: free goods cannot be returned (sales.free_return_allowed)`,
          { field: 'items', line: i.sriLineNo as number },
        );
      }
    }

    const against = row.srIsAgainstBill !== false && row.srBillId;
    if (against) {
      const bill = await this.bill(
        tx,
        row.srBillId as string,
        (row.srBillAccYear as string).trim(),
      );
      if (!bill || bill.sb_status !== 'POSTED') {
        refuse(
          g,
          SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED,
          'The bill this return is against is not POSTED',
          { field: 'srBillId' },
        );
      } else {
        const billDate = isoDate(bill.sb_bill_date)!;
        if (
          ctx.settings.returnWindowDays > 0 &&
          daysBetween(billDate, docDate) > ctx.settings.returnWindowDays
        ) {
          warn(
            g,
            SALES_ERROR_CODES.RETURN_WINDOW,
            `The bill is ${daysBetween(billDate, docDate)} days old; the return window is ${ctx.settings.returnWindowDays} days`,
            { field: 'srBillId' },
          );
        }
        // s.34(2): a credit note past the cut-off cannot be declared.
        const cutoff = await this.statutory.creditNoteCutoff(companyId, billDate, docDate, tx);
        if (cutoff.passed && cutoff.limit) {
          const st = {
            code: cutoff.limit.code,
            value: cutoff.limit.valueText,
            effectiveFrom: cutoff.limit.effectiveFrom,
            isCompanyOverride: cutoff.limit.isCompanyOverride,
          };
          const msg = `A credit note for a ${billDate} invoice had to be declared by ${cutoff.cutoff}`;
          (cutoff.limit.enforce === 'REFUSE' ? refuse : warn)(
            g,
            SALES_ERROR_CODES.CREDIT_NOTE_CUTOFF,
            msg,
            { field: 'srReturnDate', statutory: st },
          );
        }
        // Quantities: what the bill line sold minus what is already back.
        const lines = await tx.$queryRaw<
          { sbi_id: string; sold: Prisma.Decimal; returned: Prisma.Decimal | null }[]
        >`
          SELECT b.sbi_id, b.sbi_bill_qty AS sold,
                 (SELECT SUM(r.sri_return_qty + r.sri_free_qty) FROM sales.sale_return_item r
                    JOIN sales.sale_return h ON h.sr_id = r.sri_return_id AND h.sr_acc_year = r.sri_acc_year
                   WHERE r.sri_bill_item_id = b.sbi_id AND r.sri_is_deleted = false AND h.sr_is_deleted = false
                     AND h.sr_status = 'POSTED' AND h.sr_id <> ${(row.srId as string) ?? '00000000-0000-0000-0000-000000000000'}::uuid) AS returned
            FROM sales.sale_bill_item b
           WHERE b.sbi_bill_id = ${bill.sb_id}::uuid AND b.sbi_acc_year = ${bill.sb_acc_year}::char(9) AND b.sbi_is_deleted = false`;
        const by = new Map(lines.map((l) => [l.sbi_id, num(l.sold) - num(l.returned)]));
        const taken = new Map<string, number>();
        for (const i of items) {
          const k = i.sriBillItemId as string | null;
          if (!k) {
            continue;
          }
          taken.set(
            k,
            (taken.get(k) ?? 0) +
              num(i.sriReturnQty as Prisma.Decimal) +
              num(i.sriFreeQty as Prisma.Decimal),
          );
        }
        for (const [k, qty] of taken) {
          const open = by.get(k);
          if (open === undefined) {
            refuse(g, SALES_ERROR_CODES.RETURN_OVER_QTY, `Bill line ${k} is not on this bill`, {
              field: 'items',
            });
          } else if (qty > open + 0.0005) {
            refuse(
              g,
              SALES_ERROR_CODES.RETURN_OVER_QTY,
              `Bill line has ${open} returnable; this return takes ${qty}`,
              { field: 'items' },
            );
          }
        }
        if (mode === 'ADJUST') {
          const [abl] = await tx.$queryRaw<{ abl_pending_amount: Prisma.Decimal | null }[]>`
            SELECT abl_pending_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL'
               AND abl_is_deleted = false AND abl_is_active = true`;
          if (num(abl?.abl_pending_amount) <= 0) {
            warn(
              g,
              SALES_ERROR_CODES.CN_APPLIED,
              'The bill is already settled — nothing to adjust against; the balance will be left as an open credit',
              { field: 'srSettleMode' },
            );
          }
        }
      }
    } else if (mode === 'ADJUST') {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        'ADJUST needs a bill to adjust against — this return is not against a bill',
        { field: 'srSettleMode' },
      );
    }

    // CASH: the tenders must equal the return amount.
    if (mode === 'CASH') {
      const tenders = await this.store.loadTenders(row, tx);
      const total = round2(tenders.reduce((t, x) => t + num(x.tdAmount), 0));
      if (Math.abs(total - num(row.srReturnAmt as Prisma.Decimal)) > 0.01) {
        refuse(
          g,
          SALES_ERROR_CODES.AMOUNT_MISMATCH,
          `CASH settlement: tenders total ${total} against a return of ${num(row.srReturnAmt as Prisma.Decimal)}`,
          { field: 'tenders' },
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
  ) {
    const actor = ctx.actor;
    const keys = this.store.keysOf(row);
    const partyId = row.srCustId as string;
    const refno = (row.srReturnRefno as string) ?? keys.id;
    const docDate = isoDate(row.srReturnDate as Date) ?? isoToday();
    const returnAmt = num(row.srReturnAmt as Prisma.Decimal);
    const mode = ((row.srSettleMode as string | null) ?? 'ADJUST').toUpperCase();
    const tenders = await this.store.loadTenders(row, tx);
    const charges = await this.store.loadCharges(row, tx);
    const [company] = await tx.$queryRaw<
      { comp_state_code: string | null; comp_einvoice_applicable: boolean }[]
    >`
      SELECT comp_state_code, comp_einvoice_applicable FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
    const nature = supplyNatureOf(company?.comp_state_code, row.srPosStcd as string | null);

    // 1 · the goods come back.
    const moving = items.filter(
      (i) =>
        !(i.sriIsService as boolean) &&
        num(i.sriReturnQty as Prisma.Decimal) + num(i.sriFreeQty as Prisma.Decimal) > 0,
    );
    const stock = await this.stock.post(
      tx,
      {
        docType: 'SALE_RETURN',
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        tenantId: row.srTenantId as string | null,
        deviceId: row.srDeviceId as string | null,
        sessionId: row.srSessionId as string | null,
        docDate,
        docDatetime: (row.srReturnDatetime as Date | null) ?? now,
        refno,
        revision: revisionNo ?? (row.srRevisionNo as number) ?? 1,
        partyId,
        direction: 'IN',
        txnType: 'SALE_RETURN',
        lines: moving.map((i) => ({
          lineId: i.sriId as string,
          lineNo: i.sriLineNo as number,
          itemId: i.sriItemId as string,
          itemUnitId: i.sriItemUnitId as string,
          godownId: i.sriGodownId as string,
          lotId: i.sriLotId as string | null,
          bucket:
            (i.sriBucket as string | null) ??
            BUCKET_BY_CONDITION[(i.sriCondition as string) ?? 'RESTOCK'] ??
            'SALEABLE',
          qty: num(i.sriReturnQty as Prisma.Decimal),
          freeQty: num(i.sriFreeQty as Prisma.Decimal),
          weightQty: i.sriWeightQty === null ? null : num(i.sriWeightQty as Prisma.Decimal),
          toBaseFactor: num(i.sriToBaseFactor as Prisma.Decimal) || null,
          batchNo: i.sriBatchNo as string | null,
          batchDate: isoDate(i.sriBatchDate as Date | null),
          expiryDate: isoDate(i.sriExpiryDate as Date | null),
          serialNo: i.sriSerialNo as string | null,
          mrp: i.sriMaxPrice === null ? null : num(i.sriMaxPrice as Prisma.Decimal),
          rate: num(i.sriRate as Prisma.Decimal),
          costRate: num(i.sriCostPrice as Prisma.Decimal) || null,
          taxPerc: num(i.sriTaxPerc as Prisma.Decimal),
        })),
      },
      actor,
      now,
    );
    for (const i of moving) {
      await this.store.updateItem(tx, i, {
        sriLotId: stock.lotByLine.get(i.sriId as string) ?? i.sriLotId ?? null,
      });
    }
    const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;

    // 2 · the legs — the bill's mirror. CASH refunds through the tenders.
    const n = (k: string) => num(row[k] as Prisma.Decimal);
    const legs = buildReturnLegs({
      partyLedgerId: partyId,
      supplyNature: nature,
      salesAmount: n('srTaxableAmt'),
      taxes: bucketTaxes(
        items.map((i) => ({
          taxId: i.sriTaxId as string | null,
          cgst: num(i.sriCgstAmt as Prisma.Decimal),
          sgst: num(i.sriSgstAmt as Prisma.Decimal),
          igst: num(i.sriIgstAmt as Prisma.Decimal),
          cess: num(i.sriCessAmt as Prisma.Decimal),
        })),
      ),
      charges: charges.map((c) => ({
        ledgerId: c.cdLedgerCode,
        amount: num(c.cdAmount),
        separatelyPosted: c.cdSepPost,
        cgst: num(c.cdCgstAmt),
        sgst: num(c.cdSgstAmt),
        igst: num(c.cdIgstAmt),
        cess: num(c.cdCessAmt),
        name: c.cdChgName,
      })),
      cashDiscount: n('srCashDisc'),
      schemeDiscount: ctx.settings.postSchemeDiscSeparately
        ? n('srSchDisc') + n('srBillSchDisc')
        : 0,
      roundOff: n('srRoundOff'),
      tenders:
        mode === 'CASH'
          ? tenders.map((t) => ({
              tenderTypeId: Number(t.tdTenderTypeId),
              tenderLedgerId: t.tdTenderLedgerId,
              amount: num(t.tdAmount),
              isLoyalty: Number(t.tdTenderTypeId) === TENDER_TYPE.LOYALTY,
              isCredit: [TENDER_TYPE.CREDIT, TENDER_TYPE.TEMP_CREDIT].includes(
                Number(t.tdTenderTypeId) as 8 | 9,
              ),
              name: t.tdTenderName,
            }))
          : [],
      cogsAmount: cogs,
    });
    const voucher = await this.legs.postLegs(tx, {
      header: {
        companyId: keys.companyId,
        branchId: keys.branchId,
        tenantId: row.srTenantId as string | null,
        accYear: keys.accYear,
        voucherTypeId: SALES_VOUCHER_TYPE.SALE_RETURN,
        voucherDate: docDate,
        srcModule: 'SALES',
        srcDocType: 'SALE_RETURN',
        srcDocId: keys.id,
        docRefno: refno,
        docDate,
        usrRefno: row.srUsrRefno as string | null,
        docAmount: returnAmt,
        roundOff: n('srRoundOff'),
        partyId,
        userId: isUuid(row.srUserId as string) ? (row.srUserId as string) : actor,
        sessionId: row.srSessionId as string | null,
        deviceType: row.srDeviceType as string | null,
        remarks: row.srReturnReason as string | null,
        deviceCode:
          (row.srBillMode as string | null) === 'POS' ? (row.srDeviceId as string | null) : null,
        createdBy: actor,
        presetRefno: row.srReturnRefno as string,
        presetNo: row.srReturnSlno as bigint | null,
      },
      legs,
    });

    // 3 · the register — a CREDIT NOTE, sign −1.
    const reg = await this.register.write(
      tx,
      this.registerDoc(
        row,
        items,
        charges,
        voucher.voucherId,
        voucher.voucherLastNo,
        nature,
        actor,
      ),
      {
        companyEinvoiceFlag: company?.comp_einvoice_applicable ?? false,
        interState: nature === 'INTER',
      },
    );

    // 4 · the credit the customer holds, and how it is settled.
    const refunded =
      mode === 'CASH'
        ? round2(
            tenders
              .filter(
                (t) =>
                  ![TENDER_TYPE.CREDIT, TENDER_TYPE.TEMP_CREDIT].includes(
                    Number(t.tdTenderTypeId) as 8 | 9,
                  ),
              )
              .reduce((t, x) => t + num(x.tdAmount), 0),
          )
        : 0;
    const cnAbl = await tx.accBillBalance.create({
      data: {
        ablCompanyId: keys.companyId,
        ablBranchId: keys.branchId,
        ablTenantId: row.srTenantId as string | null,
        ablAccYear: keys.accYear,
        ablPartyId: partyId,
        ablSalesmanId: ((row.srSalesmanId as string[] | null) ?? [])[0] ?? null,
        ablAgentId: row.srAgentId as string | null,
        ablBillType: 'SALES_RETURN',
        ablSrcModule: 'SALES',
        ablSrcDocType: 'SALE_RETURN',
        ablSrcDocId: keys.id,
        ablSrcAccYear: keys.accYear,
        ablParentBillId: null,
        ablVoucherId: voucher.voucherId,
        ablVoucherTypeId: SALES_VOUCHER_TYPE.SALE_RETURN,
        ablVoucherNo: (row.srReturnSlno as bigint | null) ?? voucher.voucherLastNo,
        ablVoucherDate: row.srReturnDate as Date,
        ablVoucherRefno: refno,
        ablDocRefno: refno,
        ablDocDate: row.srReturnDate as Date,
        ablDrCr: 'CR',
        ablBillAmount: new Prisma.Decimal(returnAmt.toFixed(2)),
        ablAllocAmount: new Prisma.Decimal(Math.min(refunded, returnAmt).toFixed(2)),
        ablNarration: row.srReturnReason as string | null,
        ablCreatedOn: now,
        ablCreatedBy: actor,
      },
      select: { ablId: true },
    });
    let adjusted = 0;
    if (mode === 'ADJUST' && row.srBillId) {
      const bill = await this.bill(
        tx,
        row.srBillId as string,
        (row.srBillAccYear as string).trim(),
      );
      const [billAbl] = bill
        ? await tx.$queryRaw<
            {
              abl_id: string;
              abl_pending_amount: Prisma.Decimal | null;
              abl_bill_amount: Prisma.Decimal;
              abl_alloc_amount: Prisma.Decimal;
            }[]
          >`
            SELECT abl_id, abl_pending_amount, abl_bill_amount, abl_alloc_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL'
               AND abl_is_deleted = false AND abl_is_active = true FOR UPDATE`
        : [];
      const pending = num(billAbl?.abl_pending_amount);
      adjusted = round2(Math.min(pending, returnAmt));
      if (bill && billAbl && adjusted > 0) {
        const live = await this.liveAdjustments(tx, billAbl.abl_id, bill.sb_acc_year);
        await syncBillAdjustments(
          tx,
          {
            billId: billAbl.abl_id,
            billAccYear: bill.sb_acc_year,
            billAmount: billAbl.abl_bill_amount,
            // The helper rewrites abl_alloc_amount as paid + Σ adjustments, so
            // "paid" is the tenders alone: the allocation with the set-offs it
            // already carries taken back out.
            paidAmount: paidBaseOf(billAbl.abl_alloc_amount, live),
            companyId: keys.companyId,
            branchId: keys.branchId,
            tenantId: row.srTenantId as string | null,
            accYear: bill.sb_acc_year,
            partyId,
            adjDate: row.srReturnDate as Date,
            userId: isUuid(row.srUserId as string) ? (row.srUserId as string) : actor,
            sessionId: row.srSessionId as string | null,
          },
          [
            ...live,
            {
              againstBillId: cnAbl.ablId,
              againstBillAccYear: keys.accYear,
              amount: adjusted,
            } as SaveBillAdjustmentDto,
          ],
          actor,
          now,
        );
      }
    }
    const credited = round2(returnAmt - refunded - adjusted);
    const settleStatus =
      refunded >= returnAmt - 0.005
        ? 'REFUNDED'
        : adjusted >= returnAmt - 0.005
          ? 'ADJUSTED'
          : refunded + adjusted <= 0.005
            ? 'CREDITED'
            : 'PARTIAL';

    // 5 · loyalty claw-back and the promotion benefit taken back.
    let loyaltyReversed = 0;
    let promoClawback = round2(
      items.reduce(
        (t, i) =>
          t + num(i.sriSchDiscAmt as Prisma.Decimal) + num(i.sriBillSchAmt as Prisma.Decimal),
        0,
      ),
    );
    if (row.srBillId) {
      const bill = await this.bill(
        tx,
        row.srBillId as string,
        (row.srBillAccYear as string).trim(),
      );
      if (
        bill?.sb_loyalty_member_id &&
        num(bill.sb_loyalty_earn_points) > 0 &&
        num(bill.sb_taxable_amt) > 0
      ) {
        const share = n('srTaxableAmt') / num(bill.sb_taxable_amt);
        const cb = await this.loyalty.clawbackForReturn(
          tx,
          {
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            docDate,
            docRefno: refno,
            memberId: bill.sb_loyalty_member_id,
          },
          share,
          { earnedOnBill: num(bill.sb_loyalty_earn_points), createdBy: actor },
        );
        loyaltyReversed = cb.clawedBack;
      }
      if (bill) {
        const returnedAmt = round2(num(bill.sb_returned_amt) + returnAmt);
        await tx.$executeRaw`
          UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric,
                 sb_return_status = CASE WHEN ${returnedAmt}::numeric >= sb_bill_amt - 0.005 THEN 'FULL' ELSE 'PARTIAL' END,
                 sb_modified_on = ${now}, sb_modified_by = ${ctx.actorName}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::char(9)`;
      }
    } else {
      promoClawback = 0;
    }

    // 6 · the header, status last.
    await this.store.setStatus(
      tx,
      row,
      'POSTED',
      {
        srPostedVoucherId: voucher.voucherId,
        srTotalCost: new Prisma.Decimal(stock.cogsTotal.toFixed(2)),
        srRefundAmt: new Prisma.Decimal(refunded.toFixed(2)),
        srAdjustedAmt: new Prisma.Decimal(adjusted.toFixed(2)),
        srCreditAmt: new Prisma.Decimal(credited.toFixed(2)),
        srSettleStatus: settleStatus,
        srLoyaltyReversePoints: new Prisma.Decimal(loyaltyReversed),
        srPromoClawbackAmt: new Prisma.Decimal(promoClawback.toFixed(2)),
        ...(revisionNo ? { srRevisionNo: revisionNo } : {}),
      },
      actor,
      now,
    );
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
      { srStatus: fromStatus },
      {
        srStatus: 'POSTED',
        srPostedVoucherId: voucher.voucherId,
        gdrId: reg.gdrId,
        refunded,
        adjusted,
        credited,
      },
      actor,
      `Sale return posted (voucher ${voucher.voucherRefno})`,
    );
    return { gdrId: reg.gdrId, einvoice: reg.einvoiceApplicable, ewaybill: reg.ewaybillApplicable };
  }

  private async liveAdjustments(
    tx: Prisma.TransactionClient,
    ablId: string,
    accYear: string,
  ): Promise<SaveBillAdjustmentDto[]> {
    const rows = await tx.$queryRaw<
      {
        abj_against_bill_id: string;
        abj_against_bill_acc_year: string;
        abj_amount: Prisma.Decimal;
      }[]
    >`
      SELECT j.abj_against_bill_id, j.abj_against_bill_acc_year, j.abj_amount
        FROM accounts.acc_bill_adjustment j
       WHERE j.abj_bill_id = ${ablId}::uuid AND j.abj_bill_acc_year = ${accYear}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'CR'
         AND j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST')
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)`;
    return rows.map(
      (r) =>
        ({
          againstBillId: r.abj_against_bill_id,
          againstBillAccYear: r.abj_against_bill_acc_year.trim(),
          amount: num(r.abj_amount),
        }) as SaveBillAdjustmentDto,
    );
  }

  private registerDoc(
    row: DocRow,
    items: DocRow[],
    charges: {
      cdSepPost: boolean;
      cdAmount: number | null;
      cdCgstAmt: number | null;
      cdSgstAmt: number | null;
      cdIgstAmt: number | null;
      cdCessAmt: number | null;
    }[],
    voucherId: string,
    voucherNo: bigint,
    nature: 'INTRA' | 'INTER',
    actor: string,
  ): RegisterDoc {
    const d = (k: string) => num(row[k] as Prisma.Decimal);
    const other = charges
      .filter((c) => c.cdSepPost)
      .reduce(
        (t, c) =>
          t +
          num(c.cdAmount) +
          num(c.cdCgstAmt) +
          num(c.cdSgstAmt) +
          num(c.cdIgstAmt) +
          num(c.cdCessAmt),
        0,
      );
    const lines: RegisterDetailLine[] = items.map((i): RegisterDetailLine => {
      const n = (k: string) => num(i[k] as Prisma.Decimal);
      const tax = n('sriCgstAmt') + n('sriSgstAmt') + n('sriIgstAmt') + n('sriCessAmt');
      return {
        rowNo: i.sriLineNo as number,
        itemId: i.sriItemId as string,
        hsnCode: i.sriHsnCode as string | null,
        unitId: i.sriItemUnitId as string,
        qty: n('sriReturnQty'),
        rate: n('sriRate'),
        discount:
          n('sriItemDiscAmt') + n('sriSplDiscAmt') + n('sriSchDiscAmt') + n('sriBillSchAmt'),
        isService: (i.sriIsService as boolean) ?? false,
        taxableValue: n('sriTaxableAmt'),
        taxId: i.sriTaxId as string | null,
        totalTaxRate: n('sriTaxPerc'),
        cgstRate: n('sriCgstPerc'),
        sgstRate: n('sriSgstPerc'),
        igstRate: n('sriIgstPerc'),
        cessRate: n('sriCessPerc'),
        cgstAmount: n('sriCgstAmt'),
        sgstAmount: n('sriSgstAmt'),
        igstAmount: n('sriIgstAmt'),
        cessAmount: n('sriCessAmt'),
        otherAmount: 0,
        totalValue: round2(n('sriTaxableAmt') + tax),
        billValue: n('sriNetAmt') || round2(n('sriTaxableAmt') + tax),
        taxability: tax > 0 || n('sriTaxPerc') > 0 ? 'TAXABLE' : 'EXEMPT',
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      };
    });
    const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
    return {
      companyId: row.srCompanyId as string,
      branchId: row.srBranchId as string,
      accYear: row.srAccYear as string,
      voucherId,
      voucherTypeId: SALES_VOUCHER_TYPE.SALE_RETURN,
      voucherNo:
        (row.srReturnSlno as bigint | null) ?? numericTail(row.srReturnRefno as string, voucherNo),
      voucherDate: isoDate(row.srReturnDate as Date)!,
      voucherRefno: row.srReturnRefno as string,
      sourceDocId: row.srId as string,
      docType: 'CREDIT_NOTE',
      tranNature: 'SALES_RETURN',
      docFlow: 'OUTWARD',
      docSign: -1,
      docNo: row.srReturnRefno as string,
      docDate: isoDate(row.srReturnDate as Date)!,
      docRefNo: (row.srBillRefno as string | null) ?? (row.srUsrRefno as string | null),
      taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
      supplyClass: 'GOODS',
      supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      placeOfSupplyCode: row.srPosStcd as string | null,
      placeOfSupplyName: row.srStateName as string | null,
      partyId: row.srCustId as string,
      partyName: row.srCustName as string | null,
      partyAddr1: row.srCustAddr as string | null,
      partyLocation: row.srCustPlace as string | null,
      partyPin: row.srCustPin as string | null,
      partyStateCode: row.srCustStcd as string | null,
      partyStateName: row.srStateName as string | null,
      partyGstType: row.srCustGstType as string | null,
      partyGstin: ((row.srCustGstin as string | null) ?? '').trim() || null,
      grossValue: d('srGrossAmt'),
      discountValue:
        d('srDiscAmt') ||
        d('srItemDisc') + d('srSplDisc') + d('srSchDisc') + d('srBillSchDisc') + d('srCashDisc'),
      taxableValue: d('srTaxableAmt'),
      cgstValue: d('srCgstAmt'),
      sgstValue: d('srSgstAmt'),
      igstValue: d('srIgstAmt'),
      cessValue: d('srCessAmt'),
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: round2(other),
      roundOff: d('srRoundOff'),
      billValue: d('srReturnAmt'),
      remarks: row.srReturnReason as string | null,
      createdBy: actor,
      lines,
    };
  }

  // ── cancel / amend ───────────────────────────────────────────────────────

  async cancel(dto: CancelSaleReturnDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.srStatus === 'CANCELLED') {
        return { ...this.keys(dto), srStatus: 'CANCELLED' };
      }
      if (row.srStatus !== 'POSTED') {
        throwSalesLocked(
          'Only a POSTED sale return can be cancelled — a DRAFT is deleted',
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'srId',
        );
      }
      const ctx = await this.ctxOf(tx, row);
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }
      await this.assertUnwindable(tx, row, dto.reason, 'cancel');
      const reversal = await this.unwind(tx, row, ctx.actor, ctx.actorName, dto.reason, now);
      await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
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
        { srStatus: 'POSTED' },
        { srStatus: 'CANCELLED' },
        ctx.actor,
        `Sale return cancelled: ${dto.reason}`,
      );
      return {
        ...this.keys(dto),
        srStatus: 'CANCELLED',
        reversalVoucherRefno: reversal,
        cancelledOn: now.toISOString(),
      };
    }, TX);
  }

  async amend(dto: AmendSaleReturnDto): Promise<Record<string, unknown>> {
    const now = new Date();
    let fire: { gdrId: string | null; einvoice: boolean; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const keys: DocKeys = {
        id: dto.srId,
        companyId: dto.srCompanyId,
        branchId: dto.srBranchId,
        accYear: dto.srAccYear,
      };
      const row = await this.store.lock(tx, keys);
      if (row.srStatus !== 'POSTED') {
        throwSalesLocked(
          row.srStatus === 'CANCELLED'
            ? 'This sale return is CANCELLED'
            : 'This sale return is a DRAFT — use /create',
          row.srStatus === 'CANCELLED'
            ? SALES_ERROR_CODES.DOC_CANCELLED
            : SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'srId',
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
          'srId',
        );
      }
      if ((row.srRevisionNo as number) !== dto.baseRevision) {
        throwSalesLocked(
          `This sale return has been amended since you opened it (now revision ${String(row.srRevisionNo)}, you sent ${dto.baseRevision})`,
          SALES_ERROR_CODES.REVISION_STALE,
          'baseRevision',
        );
      }
      const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
      // Lock 2: a declared credit note is cancelled and raised again, never amended.
      await assertAmendable(tx, gdrId);
      await this.assertUnwindable(tx, row, dto.editRemark, 'amend');
      const before = this.store.plain(row);
      await this.unwind(tx, row, ctx.actor, ctx.actorName, `Amended: ${dto.editRemark}`, now);
      const draft = await this.store.setStatus(
        tx,
        row,
        'DRAFT',
        {
          srPostedVoucherId: null,
          srRefundAmt: 0,
          srAdjustedAmt: 0,
          srCreditAmt: 0,
          srSettleStatus: 'PENDING',
          srLoyaltyReversePoints: 0,
          srPromoClawbackAmt: 0,
        },
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
        { ...(saveDto as unknown as DocRow), srId: keys.id },
        ctx.actor,
        now,
      );
      const items = await this.store.loadItems(tx, saved);
      const g = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.guards(tx, saved, items, ctx, g);
      if (g.refusals.length > 0) {
        throwSalesRefusals('Sale return cannot be amended', g.refusals);
      }
      fire = await this.postCore(
        tx,
        saved,
        items,
        ctx,
        now,
        'DRAFT',
        (row.srRevisionNo as number) + 1,
      );
      await this.store.auditChange(
        tx,
        saved,
        'update',
        before,
        this.store.plain(saved),
        ctx.actor,
        `Sale return amended to revision ${(row.srRevisionNo as number) + 1}: ${dto.editRemark}`,
      );
    }, TX);
    if (fire) {
      this.gst.enqueueAfterPost(
        fire as { gdrId: string | null; einvoice: boolean; ewaybill: boolean },
      );
    }
    return this.get({
      id: dto.srId,
      companyId: dto.srCompanyId,
      branchId: dto.srBranchId,
      accYear: dto.srAccYear,
    });
  }

  /** How much of this credit note somebody else has used — the CN_APPLIED lock. */
  private async creditApplied(c: Prisma.TransactionClient, row: DocRow): Promise<number> {
    const [r] = await c.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId as string}::uuid AND b.abl_acc_year = ${row.srAccYear as string}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         -- Its own ADJUST settlement against the original bill is not somebody else's use.
         AND NOT (j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_against_bill_id IN (
               SELECT abl_id FROM accounts.acc_bill_balance WHERE abl_src_doc_id = ${(row.srBillId as string | null) ?? '00000000-0000-0000-0000-000000000000'}::uuid))`;
    return Number(r?.n ?? 0);
  }

  private async adjustedBills(
    c: Prisma.TransactionClient,
    row: DocRow,
  ): Promise<{ ablId: string; refno: string | null; amount: number }[]> {
    const rows = await c.$queryRaw<
      { abl_id: string; abl_doc_refno: string | null; amount: Prisma.Decimal }[]
    >`
      SELECT k.abl_id, k.abl_doc_refno, j.abj_amount AS amount
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId as string}::uuid AND b.abl_acc_year = ${row.srAccYear as string}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)`;
    return rows.map((r) => ({ ablId: r.abl_id, refno: r.abl_doc_refno, amount: num(r.amount) }));
  }

  private async assertUnwindable(
    tx: Prisma.TransactionClient,
    row: DocRow,
    reason: string,
    verb: 'cancel' | 'amend',
  ): Promise<void> {
    const keys = this.store.keysOf(row);
    const docDate = isoDate(row.srReturnDate as Date) ?? isoToday();
    await assertAccYearWritable(tx, keys.companyId, keys.accYear, 'srAccYear');
    if (await loadDayClosed(tx, keys.companyId, keys.branchId, docDate)) {
      throwSalesLocked(
        `The books for ${docDate} are closed at this branch`,
        SALES_ERROR_CODES.DAY_CLOSED,
        'srReturnDate',
      );
    }
    if ((await this.creditApplied(tx, row)) > 0) {
      throwSalesLocked(
        'This credit note has been set off against a bill or refunded — money has moved; reverse it with a document, not by un-doing this one',
        SALES_ERROR_CODES.CN_APPLIED,
        'srId',
      );
    }
    const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
    const { irnLive, ewbLive } = await loadDeclaredLocks(tx, gdrId);
    if (irnLive || ewbLive) {
      const gst = await this.blocks.gstRows(tx, gdrId, keys.accYear);
      if (irnLive) {
        const w = gst.irnGeneratedOn
          ? await this.statutory.withinCancelWindow(
              keys.companyId,
              'IRN',
              gst.irnGeneratedOn,
              docDate,
              new Date(),
              tx,
            )
          : { within: false };
        if (!w.within) {
          throwSalesLocked(
            `The credit note IRN's cancellation window has passed — it cannot be ${verb === 'cancel' ? 'cancelled' : 'amended'} now`,
            SALES_ERROR_CODES.IRN_WINDOW_PASSED,
            'posting.irn',
          );
        }
        await this.gst.cancelIrn({
          gdrId: gdrId!,
          accYear: keys.accYear,
          companyId: keys.companyId,
          reason,
        });
      }
      if (ewbLive) {
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
          reason,
        });
      }
    }
  }

  private async unwind(
    tx: Prisma.TransactionClient,
    row: DocRow,
    actor: string,
    /** For the bill's text sb_modified_by — see SalesCallContext.actorName. */
    actorName: string,
    reason: string,
    now: Date,
  ): Promise<string | null> {
    const keys = this.store.keysOf(row);
    let reversal: string | null = null;
    if (row.srPostedVoucherId) {
      const r = await this.legs.reverseLegs(
        tx,
        row.srPostedVoucherId as string,
        keys.accYear,
        reason,
        actor,
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
        docType: 'SALE_RETURN',
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        direction: 'IN',
        txnType: 'SALE_RETURN',
      },
      actor,
      reason,
      now,
    );
    const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
    if (gdrId) {
      await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
    }
    // The ADJUST settlement against the bill is taken back, then the CR row retired.
    const cn = await tx.accBillBalance.findFirst({
      where: {
        ablSrcDocId: keys.id,
        ablAccYear: keys.accYear,
        ablSrcDocType: 'SALE_RETURN',
        ablIsDeleted: false,
      },
      select: { ablId: true },
    });
    if (cn && row.srBillId && row.srCustId) {
      const bill = await this.bill(
        tx,
        row.srBillId as string,
        (row.srBillAccYear as string).trim(),
      );
      const [billAbl] = bill
        ? await tx.$queryRaw<
            { abl_id: string; abl_bill_amount: Prisma.Decimal; abl_alloc_amount: Prisma.Decimal }[]
          >`
            SELECT abl_id, abl_bill_amount, abl_alloc_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false FOR UPDATE`
        : [];
      if (bill && billAbl) {
        const all = await this.liveAdjustments(tx, billAbl.abl_id, bill.sb_acc_year);
        const live = all.filter((a) => a.againstBillId !== cn.ablId);
        await syncBillAdjustments(
          tx,
          {
            billId: billAbl.abl_id,
            billAccYear: bill.sb_acc_year,
            billAmount: billAbl.abl_bill_amount,
            // Tenders only — see postCore. Every set-off still live, this
            // note's included, comes out of the allocation before the helper
            // adds back the ones that survive.
            paidAmount: paidBaseOf(billAbl.abl_alloc_amount, all),
            companyId: keys.companyId,
            branchId: keys.branchId,
            tenantId: row.srTenantId as string | null,
            accYear: bill.sb_acc_year,
            partyId: row.srCustId as string,
            adjDate: row.srReturnDate as Date,
            userId: isUuid(row.srUserId as string) ? (row.srUserId as string) : actor,
            sessionId: row.srSessionId as string | null,
          },
          live,
          actor,
          now,
        );
        const returnedAmt = Math.max(
          0,
          round2(num(bill.sb_returned_amt) - num(row.srReturnAmt as Prisma.Decimal)),
        );
        await tx.$executeRaw`
          UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric,
                 sb_return_status = CASE WHEN ${returnedAmt}::numeric <= 0.005 THEN NULL WHEN ${returnedAmt}::numeric >= sb_bill_amt - 0.005 THEN 'FULL' ELSE 'PARTIAL' END,
                 sb_modified_on = ${now}, sb_modified_by = ${actorName}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::char(9)`;
      }
    }
    if (cn) {
      await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: cn.ablId, ablAccYear: keys.accYear } },
        data: {
          ablIsActive: false,
          ablIsDeleted: true,
          ablNarration: reason,
          ablModifiedOn: now,
          ablModifiedBy: actor,
        },
      });
    }
    // The claw-back is a draw keyed by this return; reversing the document reverses it.
    await this.loyalty.reverseForCancel(
      tx,
      {
        docId: keys.id,
        accYear: keys.accYear,
        docType: 'SALE_RETURN',
        docRefno: row.srReturnRefno as string | null,
      },
      { reason, createdBy: actor },
    );
    await this.promo.reverse(tx, { docId: keys.id, accYear: keys.accYear }, reason, actor);
    return reversal;
  }

  async transport(dto: SaleReturnTransportDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.srStatus === 'CANCELLED') {
        throwSalesLocked('This sale return is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'srId');
      }
      const actor = this.salesContext.actor();
      const gdrId = await this.register.registerIdOf(
        tx,
        row.srId as string,
        row.srAccYear as string,
      );
      const band = await this.transportBand.write(
        tx,
        {
          docType: 'SALE_RETURN',
          docId: row.srId as string,
          accYear: row.srAccYear as string,
          companyId: row.srCompanyId as string,
          branchId: row.srBranchId as string,
          tenantId: row.srTenantId as string | null,
          docRefno: row.srReturnRefno as string,
        },
        { ...dto.transport, direction: 'INWARD' },
        actor,
        { gdrId, now },
      );
      await this.store.trail(
        tx,
        row,
        'TRANSPORT_EDITED',
        row.srStatus as string,
        row.srStatus as string,
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

/**
 * What the bill's tenders settled: its allocation less the set-offs it already
 * carries. `syncBillAdjustments` writes `abl_alloc_amount = paid + Σ adjust`,
 * so handing it the whole allocation as "paid" counts every existing set-off
 * twice — and on an unwind leaves the bill CLOSED after its credit is gone.
 */
function paidBaseOf(
  allocation: Prisma.Decimal,
  live: readonly { amount: number | string }[],
): Prisma.Decimal {
  const adjusted = live.reduce(
    (t, a) => t.plus(new Prisma.Decimal(a.amount)),
    new Prisma.Decimal(0),
  );
  const base = new Prisma.Decimal(allocation).minus(adjusted);
  return base.lessThan(0) ? new Prisma.Decimal(0) : base;
}
