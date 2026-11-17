import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withBatchDetails } from '../../stocks/batch-detail/batch-detail.helper';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDrCr } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { DcFulfilmentService } from '../posting/dc-fulfilment.service';
import { SaleOrderService } from '../sale-order/sale-order.service';
import { StockReservationService } from '../posting/stock-reservation.service';
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
  info,
  loadDayClosed,
  loadDeclaredLocks,
  lockSourceOrders,
  refuse,
  warn,
} from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRefusals, throwSalesRight } from '../posting/sales.errors';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type RightsBlock,
  type SalesGuardContext,
  type SalesRefusal,
} from '../posting/types/posting.types';
import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
import type { MenuRight } from '../../../common/posting/rights';
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
  allocateDcDocNumber,
  assertNoCharges,
  dcAgeing,
  dcEwayStateOf,
  dcLineNames,
  dcSourceOrdersOfLines,
  dec,
  nextRegisterVoucherNo,
  orderLineKeysOf,
  orderLineRefsOf,
  registerDocTaxability,
  registerLineTaxability,
} from '../delivery-challan/dc-common';
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
  DcReturnOpenLinesQueryDto,
  DcReturnTransportDto,
  PostDcReturnDto,
} from './dto/dc-return-lifecycle.dto';

/**
 * HANDOVER §5 + challan plan §5.3 / §8.3 (2026-11-16) — `/api/v1/dc-returns`,
 * menu 251 "Challan Return".
 *
 * Goods come back against a POSTED challan. Every line fact (item, unit,
 * factor, lot, batch, rate, cost, tax, HSN) and the party come from the
 * challan (decision 35): the client sends only the challan line, the qty, the
 * condition, the godown and a remark. Stock IN (DC_RETURN, bucket by condition),
 * the COGS pair reversed under PERPETUAL on a `DCR` voucher, a CHALLAN register
 * row inward for the e-way bill. NO amend, ever: a mistake is cancel +
 * re-enter. The band is its only editable surface after POSTED.
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
  statusDocType: TxnStatusDocType.DC_RETURN,
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
  // The server fills these from the challan line before the store sees the body.
  itemRequired: ['sdriDcItemId', 'sdriItemId', 'sdriItemUnitId', 'sdriGodownId'],
  // sdrDcId / sdrDcAccYear are the challan the return answers: required by
  // the DTO, NOT NULL on the table, and not among the optional fields the
  // store copies — so they are named here or Prisma asks for the `dc` relation.
  headerRequired: ['sdrCounterId', 'sdrDcId', 'sdrDcAccYear'],
  itemDefaults: (h) => ({ sdriPriceLevel: 1, sdriDcAccYear: h.sdrDcAccYear }),
  headerWhereUnique: 'sdrId_sdrAccYear',
  itemWhereUnique: 'sdriId_sdriAccYear',
};

/** Decision 15 (Q15): the bucket follows the condition; it is never typed. */
export const BUCKET_BY_CONDITION: Record<string, string> = {
  RESTOCK: 'SALEABLE',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
  SCRAP: 'QUARANTINE',
};
const CONDITIONS = Object.keys(BUCKET_BY_CONDITION);
const TX = { timeout: 60_000, maxWait: 10_000 } as const;

/** Decision 34 — the route's right on menu 251. */
const RIGHT_CODE: Record<MenuRight, string> = {
  view: SALES_ERROR_CODES.RIGHT_VIEW,
  create: SALES_ERROR_CODES.RIGHT_CREATE,
  edit: SALES_ERROR_CODES.RIGHT_EDIT,
  delete: SALES_ERROR_CODES.RIGHT_DELETE,
  print: SALES_ERROR_CODES.RIGHT_PRINT,
  export: SALES_ERROR_CODES.RIGHT_EXPORT,
  post: SALES_ERROR_CODES.RIGHT_POST,
  cancel: SALES_ERROR_CODES.RIGHT_CANCEL,
  amend: SALES_ERROR_CODES.RIGHT_AMEND,
  override: SALES_ERROR_CODES.RIGHT_OVERRIDE,
  retender: SALES_ERROR_CODES.RIGHT_RETENDER,
};

/** The challan header facts a return copies and checks. */
interface ChallanFacts {
  sdcId: string;
  sdcAccYear: string;
  sdcCompanyId: string;
  sdcBranchId: string;
  sdcDcRefno: string;
  sdcDcDate: Date;
  sdcStatus: string;
  sdcPurpose: string | null;
  sdcCustId: string;
  sdcCustName: string | null;
  sdcCustGstin: string | null;
  sdcCustStcd: string | null;
  sdcPosStcd: string | null;
  sdcDcAmt: Prisma.Decimal | null;
}

/** What /post and /cancel answer about the challan beside the /get payload. */
interface ChallanOpen {
  sdcId: string;
  sdcAccYear: string;
  refno: string | null;
  openBefore: string;
  openAfter: string;
}

const ZERO = new Prisma.Decimal(0);
/** P6 S4: a return answers a challan of its own company AND branch only (as /open-lines). */
const ofReturnScope = (
  challan: Pick<ChallanFacts, 'sdcCompanyId' | 'sdcBranchId'>,
  companyId: string,
  branchId: string,
): boolean => challan.sdcCompanyId === companyId && challan.sdcBranchId === branchId;
/**
 * P6 R4: what a return line shares pro rata from its challan line (return key,
 * challan key, decimal places). The tax and the amount are summed from them.
 */
const SHARED_FIGURES = [
  ['sdriGrossAmt', 'sdiGrossAmt', 2],
  ['sdriItemDiscAmt', 'sdiItemDiscAmt', 2],
  ['sdriSchDiscAmt', 'sdiSchDiscAmt', 2],
  ['sdriTaxableAmt', 'sdiTaxableAmt', 2],
  ['sdriCgstAmt', 'sdiCgstAmt', 2],
  ['sdriSgstAmt', 'sdiSgstAmt', 2],
  ['sdriIgstAmt', 'sdiIgstAmt', 2],
  ['sdriCessAmt', 'sdiCessAmt', 2],
  ['sdriWeightQty', 'sdiWeightQty', 3],
] as const;
const SETTLED_FIGURES: readonly string[] = SHARED_FIGURES.map(([k]) => k);
const TAX_PARTS = ['sdriCgstAmt', 'sdriSgstAmt', 'sdriIgstAmt', 'sdriCessAmt'] as const;

/** Σ of the POSTED (live, not cancelled) returns' figures per challan line, and their qty. */
export async function postedReturnSums(
  c: Prisma.TransactionClient,
  sdiIds: readonly string[],
): Promise<Map<string, Record<string, Prisma.Decimal | null>>> {
  const ids = [...new Set(sdiIds.filter((v) => typeof v === 'string' && v.length === 36))];
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await c.$queryRaw<
    {
      dc_item_id: string;
      qty: Prisma.Decimal | null;
      gross: Prisma.Decimal | null;
      item_disc: Prisma.Decimal | null;
      sch_disc: Prisma.Decimal | null;
      taxable: Prisma.Decimal | null;
      cgst: Prisma.Decimal | null;
      sgst: Prisma.Decimal | null;
      igst: Prisma.Decimal | null;
      cess: Prisma.Decimal | null;
      weight: Prisma.Decimal | null;
    }[]
  >`
    SELECT r.sdri_dc_item_id AS dc_item_id, SUM(r.sdri_return_qty) AS qty,
           SUM(r.sdri_gross_amt) AS gross, SUM(r.sdri_item_disc_amt) AS item_disc, SUM(r.sdri_sch_disc_amt) AS sch_disc,
           SUM(r.sdri_taxable_amt) AS taxable, SUM(r.sdri_cgst_amt) AS cgst, SUM(r.sdri_sgst_amt) AS sgst,
           SUM(r.sdri_igst_amt) AS igst, SUM(r.sdri_cess_amt) AS cess, SUM(r.sdri_weight_qty) AS weight
      FROM sales.sale_dc_return_item r
      JOIN sales.sale_dc_return h ON h.sdr_id = r.sdri_return_id AND h.sdr_acc_year = r.sdri_acc_year
     WHERE r.sdri_dc_item_id = ANY(${ids}::uuid[])
       AND r.sdri_is_deleted = false AND h.sdr_is_deleted = false AND h.sdr_status = 'POSTED'
     GROUP BY r.sdri_dc_item_id`;
  return new Map(
    (rows ?? []).map((r) => [
      r.dc_item_id,
      {
        qty: r.qty,
        sdriGrossAmt: r.gross,
        sdriItemDiscAmt: r.item_disc,
        sdriSchDiscAmt: r.sch_disc,
        sdriTaxableAmt: r.taxable,
        sdriCgstAmt: r.cgst,
        sdriSgstAmt: r.sgst,
        sdriIgstAmt: r.igst,
        sdriCessAmt: r.cess,
        sdriWeightQty: r.weight,
      },
    ]),
  );
}

/**
 * P6 R4 (re-review 11-17): each return line's money is its challan line's
 * share (qty ÷ challan qty, each figure rounded), so three returns of 1 out of
 * 3 drifted from the challan (taxable 100.00 → 99.99, CGST 7.88 → 7.89). The
 * return line that brings a challan line's LAST quantity back — the POSTED
 * returns' qty plus this return's lines on it make the whole challan qty —
 * takes the challan line's figures less what those took (the other lines of
 * this return on the same challan line too); its tax = the parts, its amount =
 * taxable + tax. A line partly billed is never settled this way (the returns
 * do not make its whole qty), nor one whose rest would come out below 0 (it
 * keeps its share). Mutates `items`; answers the indexes it changed.
 */
export function settleLastReturn(
  items: DocRow[],
  dcLines: ReadonlyMap<string, DocRow>,
  posted: ReadonlyMap<string, Record<string, Prisma.Decimal | null>>,
): number[] {
  const groups = new Map<string, number[]>();
  items.forEach((it, idx) => {
    const k = it.sdriDcItemId as string;
    groups.set(k, [...(groups.get(k) ?? []), idx]);
  });
  const changed: number[] = [];
  for (const [k, idxs] of groups) {
    const d = dcLines.get(k);
    const dcQty = dec(d?.sdiDcQty as Prisma.Decimal.Value);
    if (!d || dcQty.isZero()) {
      continue;
    }
    const p = posted.get(k);
    const took = idxs
      .reduce((a, i) => a.plus(dec(items[i].sdriReturnQty as Prisma.Decimal.Value)), ZERO)
      .plus(dec(p?.qty));
    if (!took.equals(dcQty)) {
      continue;
    }
    const last = idxs[idxs.length - 1];
    const others = idxs.slice(0, -1);
    const next: DocRow = {};
    let negative = false;
    for (const [rk, dk, dp] of SHARED_FIGURES) {
      if (rk === 'sdriWeightQty' && !dec(d.sdiWeightQty as Prisma.Decimal.Value).greaterThan(0)) {
        continue;
      }
      const rest = dec(d[dk] as Prisma.Decimal.Value)
        .minus(dec(p?.[rk]))
        .minus(others.reduce((a, i) => a.plus(dec(items[i][rk] as Prisma.Decimal.Value)), ZERO));
      if (rest.isNegative()) {
        negative = true;
        break;
      }
      next[rk] = rest.toFixed(dp);
    }
    if (negative) {
      continue;
    }
    const tax = TAX_PARTS.reduce((a, t) => a.plus(dec(next[t] as Prisma.Decimal.Value)), ZERO);
    next.sdriTaxAmt = tax.toFixed(2);
    next.sdriNetAmt = dec(next.sdriTaxableAmt as Prisma.Decimal.Value).plus(tax).toFixed(2);
    const it = items[last];
    if (Object.entries(next).some(([key, v]) => !dec(it[key] as Prisma.Decimal.Value).equals(dec(v as Prisma.Decimal.Value)))) {
      Object.assign(it, next);
      changed.push(last);
    }
  }
  return changed;
}

const factorOf = (v: unknown): Prisma.Decimal => {
  const f = dec(v as Prisma.Decimal.Value);
  return f.isZero() ? new Prisma.Decimal(1) : f;
};

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
    private readonly audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
    private readonly saleOrders: SaleOrderService,
    private readonly reservations: StockReservationService,
  ) {
    this.store = new SalesDocStore(DCR_SPEC, audit, charges, tenders, transportBand);
  }

  /**
   * User 2026-11-17 — a DC return re-opens the order lines its challan lines
   * were taken from (and its cancel draws them down again): those orders are
   * locked first (before the challan lines: the bill's order, decision 36) and
   * re-derived once the return's status has moved.
   */
  private async lockOrdersOf(tx: Prisma.TransactionClient, items: readonly DocRow[]): Promise<string[]> {
    // P6 S1: every order the challan lines name (their order lines and the
    // challan header's order), in one so_id-ordered lock, as the bill takes them.
    const src = await dcSourceOrdersOfLines(
      tx,
      items.map((i) => i.sdriDcItemId as string | null),
    );
    await lockSourceOrders(tx, src.orderIds, src.orderLineIds);
    return src.orderLineIds;
  }

  private async syncOrders(
    tx: Prisma.TransactionClient,
    soiIds: readonly string[],
    actor: string,
    now: Date,
    reopenRemark: string,
  ): Promise<void> {
    const refs = await orderLineRefsOf(tx, soiIds);
    if (refs.length > 0) {
      await this.saleOrders.syncOrderFulfilment(tx, { refs, reopenRemark }, actor, now);
    }
    // ...and their reservations (user 11-17): a posted return gives back what
    // its challan consumed, its cancel takes it again — re-derived.
    for (const [soId, lineNos] of await orderLineKeysOf(tx, soiIds)) {
      await this.reservations.rederiveOrderLines(tx, soId, lineNos, actor, now);
    }
  }

  private keys(dto: DcReturnKeysDto): DocKeys {
    return {
      id: dto.sdrId,
      companyId: dto.sdrCompanyId,
      branchId: dto.sdrBranchId,
      accYear: dto.sdrAccYear,
    };
  }

  /** Decision 34 — the route's right on menu 251, or 403 SALES_RIGHT_<VERB>. */
  private async assertRight(
    right: MenuRight,
    client?: Prisma.TransactionClient,
  ): Promise<RightsBlock> {
    const rights = await this.salesContext.rights(DCR_SPEC.menuId, client);
    if (!rights[right]) {
      throwSalesRight(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
    }
    return rights;
  }

  private async existingKeys(
    c: Prisma.TransactionClient,
    sdrId: string | undefined,
  ): Promise<DocKeys | null> {
    if (!sdrId) {
      return null;
    }
    const [r] = await c.$queryRaw<
      { sdr_id: string; sdr_company_id: string; sdr_branch_id: string; sdr_acc_year: string }[]
    >`
      SELECT sdr_id, sdr_company_id, sdr_branch_id, sdr_acc_year FROM sales.sale_dc_return
       WHERE sdr_id = ${sdrId}::uuid AND sdr_is_deleted = false`;
    return r
      ? {
          id: r.sdr_id,
          companyId: r.sdr_company_id,
          branchId: r.sdr_branch_id,
          accYear: r.sdr_acc_year.trim(),
        }
      : null;
  }

  /** Notes 89 (G9) — ONE revision per save, on screen 100 'DC Return'. */
  private async writeRevision(
    tx: Prisma.TransactionClient,
    keys: DocKeys,
    before: Record<string, unknown> | null,
    actor: string,
    notes: string,
  ): Promise<void> {
    const after = await this.documentOf(tx, keys);
    await this.audit.logDocumentRevision(
      {
        screenName: DCR_SPEC.screenName,
        tableName: DCR_SPEC.tableName,
        docId: keys.id,
        displayName: (after.sdrReturnRefno as string | null) || keys.id,
        before: before === null ? null : dcrAuditRecordOf(before),
        after: dcrAuditRecordOf(after),
        userId: actor,
        branchId: keys.branchId,
        deviceId: (after.sdrDeviceId as string | null) ?? null,
        notes,
      },
      tx,
    );
  }

  // ── the body from the challan (decision 35) ───────────────────────────────

  private async challanOf(
    c: Prisma.TransactionClient,
    sdcId: string,
    sdcAccYear: string,
  ): Promise<ChallanFacts | null> {
    const row = (await c.saleDc.findFirst({
      where: { sdcId, sdcAccYear: sdcAccYear.trim(), sdcIsDeleted: false },
      select: {
        sdcId: true,
        sdcAccYear: true,
        sdcCompanyId: true,
        sdcBranchId: true,
        sdcDcRefno: true,
        sdcDcDate: true,
        sdcStatus: true,
        sdcPurpose: true,
        sdcCustId: true,
        sdcCustName: true,
        sdcCustGstin: true,
        sdcCustStcd: true,
        sdcPosStcd: true,
        sdcDcAmt: true,
      },
    })) as unknown as ChallanFacts | null;
    return row;
  }

  /**
   * The return as it will be stored: the header's party / challan facts and
   * every line fact copied from the challan; the client's qty, condition,
   * godown and remark kept; the bucket from the condition; no free qty; each
   * line's money its share of the challan line's. `problems` holds what makes
   * it impossible (no such challan, a line of another challan): /create throws
   * them, /validate lists them.
   */
  private async buildBody(
    c: Prisma.TransactionClient,
    dto: SaveDcReturnDto,
  ): Promise<{ body: DocRow; items: DocRow[]; challan: ChallanFacts | null; problems: SalesRefusal[] }> {
    const problems: SalesRefusal[] = [];
    const challan = await this.challanOf(c, dto.sdrDcId, dto.sdrDcAccYear);
    // P6 S4 (user 11-17): of this company AND branch, as /open-lines asks (the
    // goods come back into this branch's godowns): else not found, its refusal.
    if (!challan || !ofReturnScope(challan, dto.sdrCompanyId, dto.sdrBranchId)) {
      problems.push({
        code: SALES_ERROR_CODES.NOT_FOUND,
        message: `No live challan ${challan?.sdcDcRefno ?? dto.sdrDcId} in this company and branch`,
        field: 'sdrDcId',
      });
    }
    const input = dto.items ?? [];
    const ids = [...new Set(input.map((i) => i.sdriDcItemId).filter((v): v is string => !!v))];
    const dcLines = ids.length
      ? ((await c.saleDcItem.findMany({
          where: { sdiId: { in: ids }, sdiIsDeleted: false },
        })) as unknown as DocRow[])
      : [];
    const byId = new Map(dcLines.map((l) => [l.sdiId as string, l]));
    const items: DocRow[] = [];
    for (const [idx, it] of input.entries()) {
      const lineNo = (it.sdriLineNo as number | null | undefined) ?? idx + 1;
      const d = byId.get(it.sdriDcItemId);
      if (
        !d ||
        !challan ||
        d.sdiDcId !== challan.sdcId ||
        String(d.sdiAccYear).trim() !== challan.sdcAccYear.trim()
      ) {
        problems.push({
          code: SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC,
          message: `Line ${lineNo} is not a line of challan ${challan?.sdcDcRefno ?? dto.sdrDcId}`,
          field: 'items',
          line: lineNo,
          params: { n: lineNo, dc: challan?.sdcDcRefno ?? '' },
        });
        continue;
      }
      items.push(this.lineFrom(it as unknown as DocRow, d, lineNo));
    }
    // P6 R4: the return that brings a challan line's last quantity back takes
    // what is left of its money (read without a lock here; /post settles it
    // again under the challan lines' lock).
    settleLastReturn(items, byId, await postedReturnSums(c, ids));
    const sum = (k: string) => items.reduce((a, i) => a.plus(dec(i[k] as Prisma.Decimal.Value)), ZERO);
    const { items: _items, charges: _charges, tenders: _tenders, ...header } = dto;
    void _items;
    void _charges;
    void _tenders;
    const body: DocRow = {
      ...(header as unknown as DocRow),
      ...(challan
        ? {
            sdrDcRefno: challan.sdcDcRefno,
            sdrDcDate: isoDate(challan.sdcDcDate),
            sdrCustId: challan.sdcCustId,
            sdrCustName: challan.sdcCustName,
            sdrCustGstin: challan.sdcCustGstin,
            sdrCustStcd: challan.sdcCustStcd,
            sdrPosStcd: challan.sdcPosStcd,
          }
        : {}),
      sdrTotItems: items.filter((i) => dec(i.sdriReturnQty as Prisma.Decimal.Value).greaterThan(0)).length,
      sdrTotWeight: sum('sdriWeightQty').toFixed(3),
      sdrGrossAmt: sum('sdriGrossAmt').toFixed(2),
      sdrTaxableAmt: sum('sdriTaxableAmt').toFixed(2),
      sdrTaxAmt: sum('sdriTaxAmt').toFixed(2),
      sdrReturnAmt: sum('sdriNetAmt').toFixed(2),
      sdrTotalCost: items
        .reduce(
          (a, i) =>
            a.plus(dec(i.sdriReturnQty as Prisma.Decimal.Value).times(dec(i.sdriCostPrice as Prisma.Decimal.Value))),
          ZERO,
        )
        .toFixed(2),
      items,
    };
    return { body, items, challan, problems };
  }

  /** One return line from the client's keys and the challan line's facts. */
  private lineFrom(it: DocRow, d: DocRow, lineNo: number): DocRow {
    const qty = dec(it.sdriReturnQty as Prisma.Decimal.Value);
    const dcQty = dec(d.sdiDcQty as Prisma.Decimal.Value);
    const share = (k: string, dp: number) =>
      dcQty.isZero()
        ? '0'
        : dec(d[k] as Prisma.Decimal.Value)
            .times(qty)
            .dividedBy(dcQty)
            .toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP)
            .toFixed(dp);
    const condition = (((it.sdriCondition as string | null) ?? 'RESTOCK').trim().toUpperCase() ||
      'RESTOCK') as string;
    const taxable = dec(share('sdiTaxableAmt', 2));
    const parts = ['sdiCgstAmt', 'sdiSgstAmt', 'sdiIgstAmt', 'sdiCessAmt'].map((k) => dec(share(k, 2)));
    const tax = parts.reduce((a, p) => a.plus(p), ZERO);
    const weight = dec(d.sdiWeightQty as Prisma.Decimal.Value);
    return {
      ...(it.sdriId ? { sdriId: it.sdriId } : {}),
      sdriLineNo: lineNo,
      sdriDcItemId: d.sdiId,
      sdriDcAccYear: String(d.sdiAccYear).trim(),
      sdriDcLineNo: d.sdiLineNo,
      sdriItemId: d.sdiItemId,
      sdriItemUnitId: d.sdiItemUnitId,
      sdriToBaseFactor: d.sdiToBaseFactor,
      sdriHsnCode: d.sdiHsnCode,
      sdriGodownId: ((it.sdriGodownId as string | null) ?? '') || d.sdiGodownId,
      sdriLotId: d.sdiLotId,
      sdriCondition: CONDITIONS.includes(condition) ? condition : 'RESTOCK',
      sdriBucket: BUCKET_BY_CONDITION[condition] ?? 'SALEABLE',
      sdriBatchNo: d.sdiBatchNo,
      sdriExpiryDate: d.sdiExpiryDate,
      sdriSerialNo: d.sdiSerialNo,
      sdriReturnQty: qty.toFixed(3),
      // Decision 35: no free goods come back on a return in this job.
      sdriFreeQty: '0',
      sdriNetQty: qty.toFixed(3),
      sdriWeightQty: weight.greaterThan(0) ? share('sdiWeightQty', 3) : null,
      sdriRate: d.sdiRate,
      sdriCostPrice: d.sdiCostPrice,
      sdriTaxId: d.sdiTaxId,
      sdriTaxPerc: d.sdiTaxPerc,
      sdriCgstPerc: d.sdiCgstPerc,
      sdriSgstPerc: d.sdiSgstPerc,
      sdriIgstPerc: d.sdiIgstPerc,
      sdriCessPerc: d.sdiCessPerc,
      sdriCessPerUnit: d.sdiCessPerUnit,
      sdriPriceLevel: d.sdiPriceLevel ?? 1,
      sdriEanCode: d.sdiEanCode,
      sdriIsTaxIncl: d.sdiIsTaxIncl ?? false,
      sdriIsService: d.sdiIsService ?? false,
      sdriRatePreTax: d.sdiRatePreTax,
      sdriMaxPrice: d.sdiMaxPrice,
      sdriItemDiscPerc: d.sdiItemDiscPerc,
      sdriItemDiscAmt: share('sdiItemDiscAmt', 2),
      sdriSchDiscAmt: share('sdiSchDiscAmt', 2),
      sdriGrossAmt: share('sdiGrossAmt', 2),
      sdriTaxableAmt: taxable.toFixed(2),
      sdriCgstAmt: parts[0].toFixed(2),
      sdriSgstAmt: parts[1].toFixed(2),
      sdriIgstAmt: parts[2].toFixed(2),
      sdriCessAmt: parts[3].toFixed(2),
      sdriTaxAmt: tax.toFixed(2),
      sdriNetAmt: taxable.plus(tax).toFixed(2),
      sdriSize: d.sdiSize,
      sdriSizeUom: d.sdiSizeUom,
      sdriRemarks: (it.sdriRemarks as string | null | undefined) ?? null,
    };
  }

  // ── create / validate / get / delete ──────────────────────────────────────

  async save(dto: SaveDcReturnDto): Promise<Record<string, unknown>> {
    assertNoCharges(dto.charges);
    const actor = this.salesContext.actor();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await this.existingKeys(tx, dto.sdrId);
      await this.assertRight(existing ? 'edit' : 'create', tx);
      const before = existing ? await this.documentOf(tx, existing) : null;
      const { body, challan, problems } = await this.buildBody(tx, dto);
      // A DRAFT challan may still change or be deleted: a return against it
      // would dangle (as /validate and /post say).
      if (
        challan &&
        challan.sdcStatus !== 'POSTED' &&
        !problems.some(
          (p) =>
            p.code === SALES_ERROR_CODES.DCR_DC_NOT_POSTED || p.code === SALES_ERROR_CODES.NOT_FOUND,
        )
      ) {
        problems.push({
          code: SALES_ERROR_CODES.DCR_DC_NOT_POSTED,
          message: `Challan ${challan.sdcDcRefno} is ${challan.sdcStatus}: only a POSTED challan takes a return`,
          field: 'sdrDcId',
        });
      }
      if (problems.length > 0) {
        throwSalesRefusals('This return cannot be saved', problems);
      }
      const saved = await this.store.saveDraft(tx, body, actor, now, {
        beforeWrite: (data) => {
          if (data.sdrReturnDatetime === undefined && !existing) {
            data.sdrReturnDatetime = now;
          }
        },
        // §5.1 — the device's own return series (DR2627D14-00001).
        numberFor: (docDate: Date) =>
          allocateDcDocNumber(tx, {
            vchrTypeId: DCR_SPEC.voucherTypeId,
            companyId: dto.sdrCompanyId,
            branchId: dto.sdrBranchId,
            accYear: dto.sdrAccYear,
            deviceId: dto.sdrDeviceId,
            documentDate: docDate,
            field: 'sdrDeviceId',
          }),
        revision: true,
      });
      await this.writeRevision(
        tx,
        this.store.keysOf(saved),
        before,
        actor,
        before ? 'Challan return updated' : 'Challan return created',
      );
      return saved;
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  /**
   * §8.3 `/validate` (G3) — the guards of `/post` on the body as it would be
   * stored, writing nothing: `{ok, refusals, warnings (INFO SALES_DCR_DAMAGED_BUCKET),
   * rights, totals}`. Right: CREATE (a new return) or EDIT (a draft).
   */
  async validate(dto: SaveDcReturnDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.sdrCompanyId, branchId: dto.sdrBranchId, deviceId: dto.sdrDeviceId },
      DCR_SPEC.menuId,
    );
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const existing = await this.existingKeys(c, dto.sdrId);
    const right: MenuRight = existing ? 'edit' : 'create';
    if (!ctx.rights[right]) {
      throwSalesRight(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
    }
    const g = createGuardContext({
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
      dryRun: true,
    });
    if (Array.isArray(dto.charges) && dto.charges.length > 0) {
      refuse(
        g,
        SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED,
        'A challan return carries no charges',
        { field: 'charges' },
      );
    }
    const { body, items, problems } = await this.buildBody(c, dto);
    for (const p of problems) {
      refuse(g, p.code, p.message, { field: p.field, line: p.line, params: p.params });
    }
    const row: DocRow = { ...body, sdrId: dto.sdrId ?? null };
    await this.prisma.$transaction((tx) => this.guards(tx, row, items, ctx, g, false), TX);
    const nameOf = await dcLineNames(
      c,
      items.map((i) => ({
        itemId: i.sdriItemId,
        itemUnitId: i.sdriItemUnitId,
        godownId: i.sdriGodownId,
        lotId: i.sdriLotId,
      })),
    );
    let qty = ZERO;
    let kg = ZERO;
    let costBack = ZERO;
    for (const i of items) {
      const q = dec(i.sdriReturnQty as Prisma.Decimal.Value);
      qty = qty.plus(q);
      const w = dec(i.sdriWeightQty as Prisma.Decimal.Value);
      kg = kg.plus(
        w.greaterThan(0)
          ? w
          : q.times(
              dec(
                nameOf({
                  itemId: i.sdriItemId,
                  itemUnitId: i.sdriItemUnitId,
                  godownId: i.sdriGodownId,
                  lotId: i.sdriLotId,
                }).unitKg,
              ),
            ),
      );
      costBack = costBack.plus(q.times(dec(i.sdriCostPrice as Prisma.Decimal.Value)));
    }
    return {
      ok: g.refusals.length === 0,
      refusals: g.refusals,
      warnings: g.warnings,
      rights: ctx.rights,
      totals: {
        lines: items.filter((i) => dec(i.sdriReturnQty as Prisma.Decimal.Value).greaterThan(0)).length,
        qty: qty.toFixed(3),
        weightKg: kg.toFixed(3),
        costBack: costBack.toFixed(2),
      },
    };
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    await this.assertRight('view', c);
    return this.documentOf(c, keys);
  }

  private async documentOf(
    c: Prisma.TransactionClient,
    keys: DocKeys,
  ): Promise<Record<string, unknown>> {
    const row = await this.store.findOrThrow(c, keys);
    const [items, transport, rights, gdrId, challan] = await Promise.all([
      this.store.loadItems(c, row),
      this.store.loadTransport(c, row),
      this.salesContext.rights(DCR_SPEC.menuId, c),
      this.register.registerIdOf(c, keys.id, keys.accYear),
      this.challanOf(c, row.sdrDcId as string, row.sdrDcAccYear as string),
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
    // §8.3: the document is editable only as a DRAFT (no amend, ever).
    locks.editable.document = row.sdrStatus === 'DRAFT';
    const nameOf = await dcLineNames(
      c,
      items.map((i) => ({
        itemId: i.sdriItemId,
        itemUnitId: i.sdriItemUnitId,
        godownId: i.sdriGodownId,
        lotId: i.sdriLotId,
      })),
    );
    const ageing = challan
      ? await dcAgeing(this.salesContext, this.statutory, {
          companyId: challan.sdcCompanyId,
          branchId: challan.sdcBranchId,
          purpose: challan.sdcPurpose,
          docDate: isoDate(challan.sdcDcDate) ?? isoToday(),
          status: challan.sdcStatus,
          today: isoToday(),
          // P6 N2: no age once nothing is open on the challan (as grid 116).
          open: (await this.challanOpen(c, row)).greaterThan(0),
        })
      : { ageDays: 0, ageLevel: '' as const, returnWindow: null, pastWindow: false };
    return {
      ...this.store.plain(row),
      // Textile addendum 2 E3.3 — each line's batch size / colour / model; G8 the names.
      items: await withBatchDetails(
        c,
        row.sdrCompanyId as string,
        'sdri',
        items.map((i) => ({
          ...this.store.plain(i),
          ...nameOf({
            itemId: i.sdriItemId,
            itemUnitId: i.sdriItemUnitId,
            godownId: i.sdriGodownId,
            lotId: i.sdriLotId,
          }),
          dcLineNo: i.sdriDcLineNo ?? null,
          bucketFromCondition: BUCKET_BY_CONDITION[(i.sdriCondition as string) ?? 'RESTOCK'] ?? null,
        })),
      ),
      charges: [],
      transport,
      posting,
      locks,
      rights: { ...rights, amend: false },
      challan: challan
        ? {
            sdcId: challan.sdcId,
            sdcAccYear: challan.sdcAccYear.trim(),
            refno: challan.sdcDcRefno,
            date: isoDate(challan.sdcDcDate),
            purpose: challan.sdcPurpose,
            ageDays: ageing.ageDays,
            ageLevel: ageing.ageLevel,
            returnWindow: ageing.returnWindow,
            pastWindow: ageing.pastWindow,
            value: dec(challan.sdcDcAmt).toFixed(2),
          }
        : null,
    };
  }

  async delete(dto: DcReturnKeysDto): Promise<{ sdrId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(async (tx) => {
      await this.assertRight('delete', tx);
      await this.store.deleteDraft(tx, this.keys(dto), actor, new Date());
    }, TX);
    return { sdrId: dto.sdrId, deleted: true };
  }

  /**
   * §8.3 `GET /dc-returns/open-lines` (G7) — the challan and every line with
   * what is left to take back, scoped to the company and branch, VIEW on 251.
   * Quantities are Decimal strings (3 places); `onDrafts` = Σ qty on DRAFT
   * returns of the line (a draft holds nothing, Q17).
   */
  async openLines(q: DcReturnOpenLinesQueryDto): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    await this.assertRight('view', c);
    const challan = await this.challanOf(c, q.sdcId, q.sdcAccYear);
    if (!challan || challan.sdcCompanyId !== q.companyId || challan.sdcBranchId !== q.branchId) {
      throwSalesNotFound(
        'Challan not found',
        'sdcId',
        `No live challan ${q.sdcId} in this company and branch`,
        SALES_ERROR_CODES.NOT_FOUND,
      );
    }
    const accYear = challan.sdcAccYear.trim();
    const [lines, bills, ageing] = await Promise.all([
      c.$queryRaw<
        {
          dc_item_id: string;
          line_no: number;
          item_id: string;
          item_unit_id: string;
          to_base_factor: Prisma.Decimal | null;
          godown_id: string;
          lot_id: string | null;
          batch_no: string | null;
          bucket: string | null;
          dc_qty: Prisma.Decimal | null;
          billed_qty: Prisma.Decimal | null;
          returned_qty: Prisma.Decimal | null;
          open_qty: Prisma.Decimal | null;
          on_drafts: Prisma.Decimal | null;
          rate: Prisma.Decimal | null;
          cost_price: Prisma.Decimal | null;
          tax_perc: Prisma.Decimal | null;
        }[]
      >`
        SELECT d.sdi_id AS dc_item_id, d.sdi_line_no AS line_no, d.sdi_item_id AS item_id,
               d.sdi_item_unit_id AS item_unit_id, d.sdi_to_base_factor AS to_base_factor,
               d.sdi_godown_id AS godown_id, d.sdi_lot_id AS lot_id, d.sdi_batch_no AS batch_no,
               d.sdi_bucket AS bucket, d.sdi_dc_qty AS dc_qty, d.sdi_billed_qty AS billed_qty,
               d.sdi_returned_qty AS returned_qty, d.sdi_open_qty AS open_qty,
               COALESCE((SELECT SUM(r.sdri_return_qty)
                           FROM sales.sale_dc_return_item r
                           JOIN sales.sale_dc_return rh ON rh.sdr_id = r.sdri_return_id AND rh.sdr_acc_year = r.sdri_acc_year
                          WHERE r.sdri_dc_item_id = d.sdi_id AND r.sdri_is_deleted = false
                            AND rh.sdr_is_deleted = false AND rh.sdr_status = 'DRAFT'), 0) AS on_drafts,
               d.sdi_rate AS rate, d.sdi_cost_price AS cost_price, d.sdi_tax_perc AS tax_perc
          FROM sales.sale_dc_item d
         WHERE d.sdi_dc_id = ${challan.sdcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
           AND d.sdi_is_deleted = false
         ORDER BY d.sdi_line_no`,
      c.$queryRaw<
        { sb_id: string; acc_year: string; refno: string | null; bill_date: Date | null; qty: Prisma.Decimal | null }[]
      >`
        SELECT h.sb_id, h.sb_acc_year AS acc_year, h.sb_bill_refno AS refno, h.sb_bill_date AS bill_date,
               SUM(b.sbi_bill_qty) AS qty
          FROM sales.sale_bill_item b
          JOIN sales.sale_bill h ON h.sb_id = b.sbi_bill_id AND h.sb_acc_year = b.sbi_acc_year
          JOIN sales.sale_dc_item d ON d.sdi_id = b.sbi_src_item_id
         WHERE b.sbi_src_doc_type = 'DELIVERY_CHALLAN' AND d.sdi_dc_id = ${challan.sdcId}::uuid
           AND b.sbi_is_deleted = false AND h.sb_is_deleted = false AND h.sb_status = 'POSTED'
         GROUP BY h.sb_id, h.sb_acc_year, h.sb_bill_refno, h.sb_bill_date
         ORDER BY h.sb_bill_date, h.sb_bill_refno`,
      dcAgeing(this.salesContext, this.statutory, {
        companyId: challan.sdcCompanyId,
        branchId: challan.sdcBranchId,
        purpose: challan.sdcPurpose,
        docDate: isoDate(challan.sdcDcDate) ?? isoToday(),
        status: challan.sdcStatus,
        today: isoToday(),
        // P6 N2: no age once nothing is open (as grids 116 / 220).
        open: (await this.challanOpen(c, { sdrDcId: challan.sdcId, sdrDcAccYear: accYear })).greaterThan(0),
      }),
    ]);
    const nameOf = await dcLineNames(
      c,
      lines.map((l) => ({
        itemId: l.item_id,
        itemUnitId: l.item_unit_id,
        godownId: l.godown_id,
        lotId: l.lot_id,
      })),
    );
    const q3 = (v: Prisma.Decimal | null) => dec(v).toFixed(3);
    return {
      challan: {
        sdcId: challan.sdcId,
        sdcAccYear: accYear,
        refno: challan.sdcDcRefno,
        date: isoDate(challan.sdcDcDate),
        status: challan.sdcStatus,
        purpose: challan.sdcPurpose,
        custId: challan.sdcCustId,
        custName: challan.sdcCustName,
        ageDays: ageing.ageDays,
        ageLevel: ageing.ageLevel,
        // P3b — DC_RETURN_WINDOW_DAYS as the ageing read it (the challan date,
        // company row first; null = no row) and whether this challan is past it.
        returnWindow: ageing.returnWindow,
        pastWindow: ageing.pastWindow,
        value: dec(challan.sdcDcAmt).toFixed(2),
        bills: bills.map((b) => ({
          sbId: b.sb_id,
          accYear: b.acc_year.trim(),
          refno: b.refno,
          date: isoDate(b.bill_date),
          qty: q3(b.qty),
        })),
      },
      lines: lines.map((l) => {
        const n = nameOf({
          itemId: l.item_id,
          itemUnitId: l.item_unit_id,
          godownId: l.godown_id,
          lotId: l.lot_id,
        });
        return {
          dcItemId: l.dc_item_id,
          lineNo: l.line_no,
          itemId: l.item_id,
          itemCode: n.itemCode,
          itemName: n.itemName,
          itemUnitId: l.item_unit_id,
          unitName: n.unitName,
          toBaseFactor: dec(l.to_base_factor).toFixed(6),
          unitKg: n.unitKg,
          godownId: l.godown_id,
          godownName: n.godownName,
          lotId: l.lot_id,
          lotNo: n.lotNo,
          batchNo: l.batch_no,
          bucket: l.bucket,
          dcQty: q3(l.dc_qty),
          billedQty: q3(l.billed_qty),
          returnedQty: q3(l.returned_qty),
          openQty: q3(l.open_qty),
          onDrafts: q3(l.on_drafts),
          rate: dec(l.rate).toFixed(4),
          costPrice: dec(l.cost_price).toFixed(4),
          taxPerc: dec(l.tax_perc).toFixed(4),
        };
      }),
    };
  }

  // ── post ─────────────────────────────────────────────────────────────────

  async post(dto: PostDcReturnDto): Promise<Record<string, unknown>> {
    let fire: { gdrId: string | null; ewaybill: boolean } | null = null;
    let challan = null as ChallanOpen | null;
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
      const g = createGuardContext({
        // P6 N5: a WARN (the backdate) goes on only overridden, as the challan's.
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      // User 11-17: the source orders first, then (decision 36) the challan
      // lines in sdi_id order, before any stock lock — the bill's lock order.
      const soiIds = await this.lockOrdersOf(tx, items);
      const openBefore = await this.lockChallanOpen(tx, row);
      // P6 R4: under that lock, the line that brings a challan line's last
      // quantity back takes the rest of its money (the POSTED returns as they are now).
      await this.settleAtPost(tx, row, items, ctx.actor);
      await this.guards(tx, row, items, ctx, g, true);
      if (g.refusals.length > 0) {
        throwSalesRefusals('DC return cannot be posted', g.refusals);
      }
      const now = new Date();
      fire = await this.postCore(tx, row, items, ctx, now);
      await this.syncOrders(
        tx,
        soiIds,
        ctx.actor,
        now,
        `Reopened: DC return ${(row.sdrReturnRefno as string | null) ?? (row.sdrId as string)} posted`,
      );
      challan = {
        sdcId: row.sdrDcId as string,
        sdcAccYear: String(row.sdrDcAccYear).trim(),
        refno: (row.sdrDcRefno as string | null) ?? null,
        openBefore: openBefore.toFixed(3),
        openAfter: (await this.challanOpen(tx, row)).toFixed(3),
      };
    }, TX);
    if (fire) {
      const f = fire as { gdrId: string | null; ewaybill: boolean };
      this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
    }
    const doc = await this.get(this.keys(dto));
    return challan ? { ...doc, challan: { ...(doc.challan as object), ...challan } } : doc;
  }

  /**
   * P6 R4 — at /post, under the challan lines' lock: the return line that brings
   * its challan line's LAST quantity back (the POSTED returns plus this one make
   * the whole challan qty) takes the challan line's figures less what those
   * returns took, so the returns add up to the challan to the paisa. Re-read
   * now (a return posted or cancelled since the draft was saved changes it);
   * the stored lines and the header's sums are rewritten when they moved.
   */
  private async settleAtPost(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    actor: string,
  ): Promise<void> {
    const ids = [...new Set(items.map((i) => i.sdriDcItemId as string).filter((v) => !!v))];
    if (ids.length === 0) {
      return;
    }
    const dcLines = (await tx.saleDcItem.findMany({
      where: { sdiId: { in: ids }, sdiIsDeleted: false },
    })) as unknown as DocRow[];
    const changed = settleLastReturn(
      items,
      new Map(dcLines.map((l) => [l.sdiId as string, l])),
      await postedReturnSums(tx, ids),
    );
    if (changed.length === 0) {
      return;
    }
    const now = new Date();
    for (const idx of changed) {
      const i = items[idx];
      await this.store.updateItem(
        tx,
        i,
        Object.fromEntries([...SETTLED_FIGURES, 'sdriTaxAmt', 'sdriNetAmt'].filter((k) => i[k] !== undefined).map((k) => [k, i[k]])),
      );
    }
    const sum = (k: string) => items.reduce((a, i) => a.plus(dec(i[k] as Prisma.Decimal.Value)), ZERO);
    const totals: DocRow = {
      sdrTotWeight: sum('sdriWeightQty').toFixed(3),
      sdrGrossAmt: sum('sdriGrossAmt').toFixed(2),
      sdrTaxableAmt: sum('sdriTaxableAmt').toFixed(2),
      sdrTaxAmt: sum('sdriTaxAmt').toFixed(2),
      sdrReturnAmt: sum('sdriNetAmt').toFixed(2),
    };
    await this.store.setStatus(tx, row, (row.sdrStatus as string) ?? 'DRAFT', totals, actor, now);
    Object.assign(row, totals);
  }

  /**
   * Σ open qty of the return's challan, under its locks: the challan header
   * first, then its lines in sdi_id order (P6 S1, decision 36: orders →
   * challan header → challan lines → stock; the caller holds the orders). The
   * header lock is what a challan cancel / amend / convert takes first, so the
   * challan's status read by the guards is the committed one.
   */
  private async lockChallanOpen(tx: Prisma.TransactionClient, row: DocRow): Promise<Prisma.Decimal> {
    await tx.$queryRaw`
      SELECT sdc_id FROM sales.sale_dc
       WHERE sdc_id = ${row.sdrDcId as string}::uuid AND sdc_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
       FOR UPDATE`;
    const rows = await tx.$queryRaw<{ open_qty: Prisma.Decimal | null }[]>`
      SELECT sdi_open_qty AS open_qty FROM sales.sale_dc_item
       WHERE sdi_dc_id = ${row.sdrDcId as string}::uuid AND sdi_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
         AND sdi_is_deleted = false
       ORDER BY sdi_id
       FOR UPDATE`;
    return rows.reduce((a, r) => a.plus(dec(r.open_qty)), ZERO);
  }

  private async challanOpen(tx: Prisma.TransactionClient, row: DocRow): Promise<Prisma.Decimal> {
    const [r] = await tx.$queryRaw<{ open_qty: Prisma.Decimal | null }[]>`
      SELECT SUM(sdi_open_qty) AS open_qty FROM sales.sale_dc_item
       WHERE sdi_dc_id = ${row.sdrDcId as string}::uuid AND sdi_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
         AND sdi_is_deleted = false`;
    return dec(r?.open_qty);
  }

  /**
   * §8.3 guards (`/validate` = `/post`): the year, the date, the challan
   * POSTED and of this company, every line on it (SALES_DCR_LINE_NOT_ON_DC), a
   * line to take back (SALES_DCR_NO_LINES), a DC-return reason (and its remark
   * when the reason wants one), the open qty per challan line in base units
   * (Decimal, under the line lock at post), and an INFO per line that comes back
   * not for sale.
   */
  private async guards(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
    stored: boolean,
  ): Promise<void> {
    const companyId = row.sdrCompanyId as string;
    const branchId = row.sdrBranchId as string;
    const accYear = row.sdrAccYear as string;
    const docDate = isoDate(row.sdrReturnDate as Date | string | null) ?? isoToday();
    await assertAccYearWritable(tx, companyId, accYear, 'sdrAccYear');
    await assertVoucherPartitionExists(tx, accYear, 'sdrAccYear');
    if (docDate > isoToday()) {
      refuse(g, SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
        field: 'sdrReturnDate',
      });
    } else if (docDate !== isoToday() && ctx.settings.backdateMode !== 'ALLOW') {
      // P6 N5 (user 11-17): WARN warns, as the challan's (it posted silently).
      (ctx.settings.backdateMode === 'REFUSE' ? refuse : warn)(
        g,
        SALES_ERROR_CODES.BACKDATE,
        `This return is dated ${docDate}, before today`,
        { field: 'sdrReturnDate' },
      );
    }
    if (await loadDayClosed(tx, companyId, branchId, docDate)) {
      refuse(
        g,
        SALES_ERROR_CODES.DAY_CLOSED,
        `The books for ${docDate} are closed at this branch`,
        { field: 'sdrReturnDate' },
      );
    }
    const challan = row.sdrDcId
      ? await this.challanOf(tx, row.sdrDcId as string, String(row.sdrDcAccYear))
      : null;
    if (challan && !ofReturnScope(challan, companyId, branchId)) {
      // P6 S4: another company's or branch's challan (validate lists it from
      // buildBody as well; the post judges the stored return here).
      if (stored) {
        refuse(
          g,
          SALES_ERROR_CODES.NOT_FOUND,
          `No live challan ${challan.sdcDcRefno} in this company and branch`,
          { field: 'sdrDcId' },
        );
      }
    } else if (challan && challan.sdcStatus !== 'POSTED') {
      refuse(
        g,
        SALES_ERROR_CODES.DCR_DC_NOT_POSTED,
        'The challan this return is against is not POSTED',
        { field: 'sdrDcId' },
      );
    }
    const taking = items.filter((i) => dec(i.sdriReturnQty as Prisma.Decimal.Value).greaterThan(0));
    // A line already refused as not on this challan is not "nothing to return" too.
    if (
      taking.length === 0 &&
      !g.refusals.some((r) => r.code === SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC)
    ) {
      refuse(g, SALES_ERROR_CODES.DCR_NO_LINES, 'No line has a quantity to take back', {
        field: 'items',
      });
    }
    await this.guardReason(tx, row, g);
    // The challan lines, read (and at post already locked) by id.
    const ids = [...new Set(taking.map((i) => i.sdriDcItemId as string))];
    const dcLines = ids.length
      ? await tx.$queryRaw<
          {
            sdi_id: string;
            sdi_dc_id: string;
            sdi_acc_year: string;
            sdi_line_no: number;
            sdi_open_qty: Prisma.Decimal | null;
            sdi_to_base_factor: Prisma.Decimal | null;
          }[]
        >`
          SELECT sdi_id, sdi_dc_id, sdi_acc_year, sdi_line_no, sdi_open_qty, sdi_to_base_factor
            FROM sales.sale_dc_item
           WHERE sdi_id = ANY(${ids}::uuid[]) AND sdi_is_deleted = false`
      : [];
    const byId = new Map(dcLines.map((l) => [l.sdi_id, l]));
    const takenBase = new Map<string, Prisma.Decimal>();
    for (const i of taking) {
      const k = i.sdriDcItemId as string;
      const d = byId.get(k);
      const lineNo = i.sdriLineNo as number;
      if (
        stored &&
        (!d || d.sdi_dc_id !== row.sdrDcId || d.sdi_acc_year.trim() !== String(row.sdrDcAccYear).trim())
      ) {
        refuse(
          g,
          SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC,
          `Line ${lineNo} is not a line of challan ${(row.sdrDcRefno as string | null) ?? ''}`,
          { field: 'items', line: lineNo, params: { n: lineNo, dc: (row.sdrDcRefno as string | null) ?? '' } },
        );
        continue;
      }
      if (!d) {
        continue;
      }
      takenBase.set(
        k,
        (takenBase.get(k) ?? ZERO).plus(
          dec(i.sdriReturnQty as Prisma.Decimal.Value).times(factorOf(i.sdriToBaseFactor)),
        ),
      );
    }
    // G6 / G15 — Σ per challan line, base units, Decimal, no epsilon.
    for (const [k, base] of takenBase) {
      const d = byId.get(k)!;
      const openBase = dec(d.sdi_open_qty).times(factorOf(d.sdi_to_base_factor));
      if (base.greaterThan(openBase)) {
        refuse(
          g,
          SALES_ERROR_CODES.DCR_OVER_OPEN,
          `Challan line ${d.sdi_line_no} has ${dec(d.sdi_open_qty).toString()} open; this return takes ${base.dividedBy(factorOf(d.sdi_to_base_factor)).toString()}`,
          { field: 'items', line: d.sdi_line_no },
        );
      }
    }
    // INFO — the value comes back, but not for sale.
    const nameOf = await dcLineNames(
      tx,
      taking.map((i) => ({
        itemId: i.sdriItemId,
        itemUnitId: i.sdriItemUnitId,
        godownId: i.sdriGodownId,
        lotId: i.sdriLotId,
      })),
    );
    for (const i of taking) {
      const condition = ((i.sdriCondition as string | null) ?? 'RESTOCK').toUpperCase();
      if (condition === 'RESTOCK') {
        continue;
      }
      const unit =
        nameOf({
          itemId: i.sdriItemId,
          itemUnitId: i.sdriItemUnitId,
          godownId: i.sdriGodownId,
          lotId: i.sdriLotId,
        }).unitName ?? '';
      const qty = dec(i.sdriReturnQty as Prisma.Decimal.Value).toString();
      info(
        g,
        SALES_ERROR_CODES.DCR_DAMAGED_BUCKET,
        `${qty} ${unit} come back ${condition}: into ${BUCKET_BY_CONDITION[condition] ?? 'SALEABLE'}, not for sale`,
        { field: 'items', line: i.sdriLineNo as number, params: { qty, unit, condition } },
      );
    }
  }

  /** Q16 — a reason from the DC-return list; DCR_OTHER (srm_require_remarks) wants the remark too. */
  private async guardReason(
    tx: Prisma.TransactionClient,
    row: DocRow,
    g: SalesGuardContext,
  ): Promise<void> {
    const reasonId = (row.sdrReasonId as string | null | undefined) ?? null;
    if (!reasonId) {
      refuse(g, SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'Say why the goods came back', {
        field: 'sdrReasonId',
      });
      return;
    }
    const [r] = await tx.$queryRaw<{ remarks: boolean | null }[]>`
      SELECT srm_require_remarks AS remarks FROM stock.stock_reason_master
       WHERE srm_id = ${reasonId}::uuid AND srm_is_deleted = false
         AND 'DC_RETURN' = ANY(srm_allowed_txn_types)
         AND (srm_company_id IS NULL OR srm_company_id = ${row.sdrCompanyId as string}::uuid)`;
    if (!r) {
      refuse(g, SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'That is not a challan-return reason', {
        field: 'sdrReasonId',
      });
    } else if (r.remarks === true && !((row.sdrReturnReason as string | null) ?? '').trim()) {
      refuse(g, SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'This reason needs a remark', {
        field: 'sdrReturnReason',
      });
    }
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
        dec(i.sdriReturnQty as Prisma.Decimal).plus(dec(i.sdriFreeQty as Prisma.Decimal)).greaterThan(0),
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
            BUCKET_BY_CONDITION[(i.sdriCondition as string) ?? 'RESTOCK'] ??
            (i.sdriBucket as string | null) ??
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
          // Goods come back at the cost they left at. sdri_cost_price is per the
          // line's unit; the engine takes a stated cost per BASE unit.
          costRate: costPerBaseOf(i),
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
          // §5.1 — the refno is the return's own (per device); no presetNo: the
          // voucher takes the company serial (ux_avh_voucher_no has no device).
          presetRefno: row.sdrReturnRefno as string,
        },
        legs: buildCogsLegs(cogs, 'RETURN'),
      });
      voucherId = v.voucherId;
    }

    // 3 · the register: a CHALLAN, inward, for the e-way bill.
    const [company] = await tx.$queryRaw<
      { comp_state_code: string | null }[]
    >`SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
    const nature = supplyNatureOf(company?.comp_state_code, row.sdrPosStcd as string | null);
    let gdrId: string | null = null;
    let ewaybill = false;
    if (row.sdrCustId) {
      const registerNo = await nextRegisterVoucherNo(tx, {
        companyId: keys.companyId,
        branchId: keys.branchId,
        accYear: keys.accYear,
        voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
      });
      const reg = await this.register.write(
        tx,
        this.registerDoc(row, items, voucherId, registerNo, nature, actor),
        {
          interState: nature === 'INTER',
          // The inward e-way floor, as the challan's: a blank POS is judged by
          // the company's own state (user 11-16).
          ewayStateCode: dcEwayStateOf(company?.comp_state_code, row.sdrPosStcd as string | null)
            .stateCode,
        },
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
    // The return's header holds no GST split (sdr_tax_amt only): its register
    // header takes the lines' sums, as the challan's carries its own (11-17).
    const sumOf = (k: string) =>
      num(items.reduce<Prisma.Decimal>((a, i) => a.plus(dec(i[k] as Prisma.Decimal)), dec(0)));
    const lines: RegisterDetailLine[] = items.map((i) => {
      const n = (k: string) => num(i[k] as Prisma.Decimal);
      const tax = n('sdriCgstAmt') + n('sdriSgstAmt') + n('sdriIgstAmt') + n('sdriCessAmt');
      const gst = {
        totalTaxRate: n('sdriTaxPerc'),
        cgstRate: n('sdriCgstPerc'),
        sgstRate: n('sdriSgstPerc'),
        igstRate: n('sdriIgstPerc'),
        cessRate: n('sdriCessPerc'),
        cgstAmount: n('sdriCgstAmt'),
        sgstAmount: n('sdriSgstAmt'),
        igstAmount: n('sdriIgstAmt'),
        cessAmount: n('sdriCessAmt'),
      };
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
        ...gst,
        otherAmount: 0,
        totalValue: round2(n('sdriTaxableAmt') + tax),
        billValue: n('sdriNetAmt') || round2(n('sdriTaxableAmt') + tax),
        // P3 fix 11-17: a returned FREE line (rate 0, tax 0) keeps the challan
        // line's GST rates, so it is TAXABLE (the Sales Bill's rule); EXEMPT
        // 500'd on chk_acc_voucher_doc_detail_non_taxable_zero.
        taxability: registerLineTaxability(gst),
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      };
    });
    return {
      companyId: row.sdrCompanyId as string,
      branchId: row.sdrBranchId as string,
      accYear: row.sdrAccYear as string,
      voucherId: voucherId ?? (row.sdrId as string),
      voucherTypeId: SALES_VOUCHER_TYPE.DC_RETURN,
      // The register's own serial (nextRegisterVoucherNo): per-device slnos repeat across PCs.
      voucherNo: voucherNo ?? numericTail(row.sdrReturnRefno as string, BigInt(0)),
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
      taxability: registerDocTaxability(lines),
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
      cgstValue: sumOf('sdriCgstAmt'),
      sgstValue: sumOf('sdriSgstAmt'),
      igstValue: sumOf('sdriIgstAmt'),
      cessValue: sumOf('sdriCessAmt'),
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: 0,
      roundOff: 0,
      billValue: d('sdrReturnAmt'),
      remarks: row.sdrReturnReason as string | null,
      createdBy: actor,
      lines,
    };
  }

  // ── cancel / transport ───────────────────────────────────────────────────

  async cancel(dto: CancelDcReturnDto): Promise<Record<string, unknown>> {
    const now = new Date();
    const out = await this.prisma.$transaction(async (tx) => {
      const row = await this.store.lock(tx, this.keys(dto));
      if (row.sdrStatus === 'CANCELLED') {
        return { reversalVoucherRefno: null as string | null, cancelledOn: null as string | null, challan: null as ChallanOpen | null };
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
      // User 11-17: the source orders first, then the challan lines (decision 36).
      const soiIds = await this.lockOrdersOf(tx, await this.store.loadItems(tx, row));
      const openBefore = await this.lockChallanOpen(tx, row);
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
      // The cancelled return takes back what it re-opened on the orders.
      await this.syncOrders(
        tx,
        soiIds,
        ctx.actor,
        now,
        `Reopened: DC return ${(row.sdrReturnRefno as string | null) ?? (row.sdrId as string)} cancelled`,
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
        reversalVoucherRefno: reversal,
        cancelledOn: now.toISOString(),
        challan: {
          sdcId: row.sdrDcId as string,
          sdcAccYear: String(row.sdrDcAccYear).trim(),
          refno: (row.sdrDcRefno as string | null) ?? null,
          openBefore: openBefore.toFixed(3),
          openAfter: (await this.challanOpen(tx, row)).toFixed(3),
        } as ChallanOpen,
      };
    }, TX);
    const doc = await this.get(this.keys(dto));
    return {
      ...doc,
      reversalVoucherRefno: out.reversalVoucherRefno,
      cancelledOn: out.cancelledOn,
      ...(out.challan ? { challan: { ...(doc.challan as object), ...out.challan } } : {}),
    };
  }

  /** §8.3 `PUT /transport` (EDIT): the INWARD band; answers the /get payload. */
  async transport(dto: DcReturnTransportDto): Promise<Record<string, unknown>> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.assertRight('edit', tx);
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
      await this.transportBand.write(
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
    }, TX);
    return this.get(this.keys(dto));
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}

/**
 * The stated cost the stock engine takes for a return line: per BASE unit
 * (sdri_cost_price ÷ the line's to-base factor, 6 places), null when the
 * challan line carried no cost (the engine then prices it).
 */
export function costPerBaseOf(i: DocRow): number | null {
  const cost = dec(i.sdriCostPrice as Prisma.Decimal.Value);
  if (!cost.greaterThan(0)) {
    return null;
  }
  return cost
    .dividedBy(factorOf(i.sdriToBaseFactor))
    .toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** The record a revision keeps: the /get payload less rights, locks, the names and the challan block. */
function dcrAuditRecordOf(doc: Record<string, unknown>): Record<string, unknown> {
  const { locks: _locks, rights: _rights, challan: _challan, ...record } = doc;
  void _locks;
  void _rights;
  void _challan;
  const items = Array.isArray(record.items) ? (record.items as Record<string, unknown>[]) : [];
  return {
    ...record,
    items: items.map((i) => {
      const {
        itemName: _i,
        itemCode: _c,
        unitName: _u,
        godownName: _g,
        lotNo: _n,
        unitKg: _k,
        bucketFromCondition: _b,
        ...line
      } = i;
      void _i;
      void _c;
      void _u;
      void _g;
      void _n;
      void _k;
      void _b;
      return line;
    }),
  };
}
