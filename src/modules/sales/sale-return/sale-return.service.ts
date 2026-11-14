import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withBatchDetails } from '../../stocks/batch-detail/batch-detail.helper';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
} from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import {
  addBillAdjustment,
  reverseBillAdjustmentsWith,
  type BillAdjustmentContext,
} from '../../../common/posting/bill-adjustment.helper';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { GstGatewayService } from '../posting/gst-gateway.service';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { PromotionUsageService } from '../posting/promotion-usage.service';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { SalesDocStore, type DocKeys, type DocRow, type DocSpec } from '../posting/sales-doc-store';
import { TillSessionService, type LiveSessionRef } from '../../till/services/till-session.service';
import {
  TillApprovalService,
  type GateAsk,
  type GateVerdict,
} from '../../till/services/till-approval.service';
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
  info,
  loadDayClosed,
  loadDeclaredLocks,
  refuse,
  warn,
} from '../posting/sales.guards';
import {
  throwSalesLocked,
  throwSalesRefusals,
  throwSalesRefused,
  throwSalesRight,
} from '../posting/sales.errors';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type SalesGuardContext,
} from '../posting/types/posting.types';
import type { RightsBlock } from '../posting/types/posting.types';
import {
  SALES_MENU_ID,
  SALES_VOUCHER_TYPE,
  TENDER_TYPE,
  bucketTaxes,
  daysBetween,
  isoDate,
  isoToday,
  num,
} from '../posting/sales-doc.utils';
import type { SalesSettings } from '../posting/sales.settings';
import { SaleReturnBillReader } from './sale-return-bill-reader';
import { D, ZERO, n, r6, signed } from './sale-return-money';
import { allocateSaleReturnNumber } from './sale-return-numbering';
import {
  billLinesJson,
  bringsStock,
  buildReturnMoney,
  chargeAsksOfBody,
  chargeAsksOfStored,
  chargeJson,
  chargeRowsOf,
  headerFieldsOf,
  lineBucketOf,
  lineFieldsOf,
  previewOf,
  storesCharge,
  type MoneyIssue,
  type ReturnMoney,
} from './sale-return-preview';
import { returnRegisterDoc } from './sale-return-register';
import { mirrorCharges, type ChargeAsk } from './sale-return-money';
import {
  buildSettlement,
  defaultSettleMode,
  proRataBack,
  settlementJson,
  type AdjustAsk,
  type RefundTender,
  type SettlementPlan,
} from './sale-return-settlement';
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
  SaleReturnBillLinesQueryDto,
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
  itemDefaults: (h) => ({ sriPriceLevel: h.srPriceLevel ?? 1 }),
  headerWhereUnique: 'srId_srAccYear',
  itemWhereUnique: 'sriId_sriAccYear',
};

const TX = { timeout: 60_000, maxWait: 10_000 } as const;

/** Setting keys the money reads beside SalesSettings (plan v5 D20 / D57). */
const MONEY_SETTING_KEYS = [
  'sales.freight_calc_type',
  'sales.loading_calc_type',
  'sales.return_expired_lot_days',
  'sales.return_settle_default',
  'accounts.receipt_bill_sort',
] as const;

/** The gate events a return can trip (D26), and the amount each is judged on. */
type GateEvent = 'SALE_RETURN' | 'SALE_CLAIM' | 'RETURN_NO_RECEIPT' | 'REFUND_CASH';

const RIGHT_CODES: Record<'view' | 'create' | 'edit' | 'delete', string> = {
  view: SALES_ERROR_CODES.RIGHT_VIEW,
  create: SALES_ERROR_CODES.RIGHT_CREATE,
  edit: SALES_ERROR_CODES.RIGHT_EDIT,
  delete: SALES_ERROR_CODES.RIGHT_DELETE,
};

interface MoneySettings {
  settings: SalesSettings;
  freightCalcType: string | null;
  loadingCalcType: string | null;
  expiredLotDays: number;
  settleDefault: string | null;
  billSort: string | null;
}

/** A saved return's own facts a re-save / validate / amend keeps (SaleReturnService.savedFacts). */
interface SavedFacts {
  custId: string | null;
  freight: string | null;
  loading: string | null;
  settleMode: string | null;
}

/**
 * D20 / review 11-14 N2 — the calc modes the money of a SAVED return is worked
 * out with: the ones it was saved with, today's setting only where it saved
 * none — the very rule /post's lockAndWorkOut reads the row by. A first save
 * (no saved row) passes undefined: today's settings.
 */
function calcOf(
  saved: SavedFacts | null,
  ms: Pick<MoneySettings, 'freightCalcType' | 'loadingCalcType'>,
): { freight: string | null; loading: string | null } | undefined {
  return saved
    ? {
        freight: saved.freight ?? ms.freightCalcType,
        loading: saved.loading ?? ms.loadingCalcType,
      }
    : undefined;
}

@Injectable()
export class SaleReturnService {
  private readonly store: SalesDocStore;
  private readonly reader = new SaleReturnBillReader();
  private readonly chargeDetail: ChargeDetailService;
  private readonly tenderDetail: TenderDetailService;

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
    private readonly audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
    private readonly till: TillSessionService,
    private readonly approvals: TillApprovalService,
  ) {
    this.store = new SalesDocStore(SR_SPEC, audit, charges, tenders, transportBand);
    this.chargeDetail = charges;
    this.tenderDetail = tenders;
  }

  private keys(dto: SaleReturnKeysDto): DocKeys {
    return {
      id: dto.srId,
      companyId: dto.srCompanyId,
      branchId: dto.srBranchId,
      accYear: dto.srAccYear,
    };
  }

  /** Menu 13's flag for a verb that has no SalesCallContext (plan v5 §6.1). */
  private async assertRight(
    right: 'view' | 'create' | 'edit' | 'delete',
    client?: Prisma.TransactionClient,
  ): Promise<RightsBlock> {
    const rights = await this.salesContext.rights(SR_SPEC.menuId, client);
    if (!rights[right]) {
      throwSalesRight(`This user may not ${right} on this menu`, RIGHT_CODES[right]);
    }
    return rights;
  }

  private async moneySettings(
    companyId: string,
    branchId: string,
    deviceId: string | null | undefined,
    settings?: SalesSettings,
  ): Promise<MoneySettings> {
    const [s, values] = await Promise.all([
      settings
        ? Promise.resolve(settings)
        : this.salesContext.settings(companyId, branchId, deviceId),
      this.salesContext.values(companyId, branchId, deviceId, MONEY_SETTING_KEYS),
    ]);
    const days = Number(values['sales.return_expired_lot_days'] ?? 0);
    return {
      settings: s,
      freightCalcType: values['sales.freight_calc_type'] ?? null,
      loadingCalcType: values['sales.loading_calc_type'] ?? null,
      expiredLotDays: Number.isFinite(days) && days > 0 ? Math.trunc(days) : 0,
      settleDefault: values['sales.return_settle_default'] ?? null,
      billSort: values['accounts.receipt_bill_sort'] ?? null,
    };
  }

  /**
   * The money of a return header + its lines (D45). `calc` overrides the
   * calc types — a posted / saved return keeps the mode it was saved with
   * (D20); a fresh save reads today's settings.
   */
  private async moneyOf(
    tx: Prisma.TransactionClient,
    header: DocRow,
    items: readonly DocRow[],
    chargeAsks: ReadonlyMap<string, ChargeAsk>,
    ms: MoneySettings,
    calc?: { freight: string | null; loading: string | null },
  ): Promise<ReturnMoney> {
    return buildReturnMoney(this.reader, tx, {
      srId: (header.srId as string | undefined) ?? null,
      companyId: header.srCompanyId as string,
      branchId: header.srBranchId as string,
      custId: (header.srCustId as string | null) ?? null,
      returnDate: isoDate(header.srReturnDate as Date | string | null) ?? isoToday(),
      againstBill: header.srIsAgainstBill !== false && !!header.srBillId,
      billId: (header.srBillId as string | null) ?? null,
      billAccYear: ((header.srBillAccYear as string | null) ?? null)?.trim() ?? null,
      priceLevel: (header.srPriceLevel as number | null) ?? null,
      posStcd: (header.srPosStcd as string | null) ?? null,
      reasonId: (header.srReasonId as string | null) ?? null,
      items,
      chargeAsks,
      settings: {
        returnWindowDays: ms.settings.returnWindowDays,
        roundOffStep: ms.settings.roundOffStep,
        freeReturnAllowed: ms.settings.freeReturnAllowed,
        freightCalcType: calc ? calc.freight : ms.freightCalcType,
        loadingCalcType: calc ? calc.loading : ms.loadingCalcType,
        expiredLotDays: ms.expiredLotDays,
      },
    });
  }

  /**
   * A billed return takes its customer, bill reference and place of supply
   * from the bill (the customer is the BILL's, whatever the client sent: the
   * credit note is raised on the party the goods were sold to).
   */
  private async fillFromBill(tx: Prisma.TransactionClient, body: DocRow): Promise<void> {
    if (body.srIsAgainstBill === false || !body.srBillId || !body.srBillAccYear) {
      await this.fillFromCustomer(tx, body);
      return;
    }
    const bill = await this.reader.billHeader(
      tx,
      body.srBillId as string,
      (body.srBillAccYear as string).trim(),
    );
    if (!bill) {
      return;
    }
    body.srIsAgainstBill = true;
    body.srBillRefno = body.srBillRefno ?? bill.refno;
    body.srBillDate = body.srBillDate ?? bill.date;
    body.srCustId = bill.custId ?? body.srCustId;
    body.srCustName = body.srCustName ?? bill.custName;
    body.srBillMode = bill.billMode ?? body.srBillMode;
    // D21 / D49 — the people come from the bill unless the operator named them.
    if (body.srAgentId === undefined || body.srAgentId === null) {
      body.srAgentId = bill.agentId;
    }
    for (const [k, v] of [
      ['srCustAddr', bill.custAddr],
      ['srCustPlace', bill.custPlace],
      ['srCustPin', bill.custPin],
      ['srCustPhone', bill.custPhone],
      ['srCustGstin', bill.custGstin],
      ['srCustGstType', bill.custGstType],
      ['srCustStcd', bill.custStcd],
      ['srPosStcd', bill.posStcd],
      ['srStateName', bill.stateName],
      ['srPriceLevel', bill.priceLevel],
    ] as const) {
      if (body[k] === undefined || body[k] === null) {
        body[k] = v;
      }
    }
  }

  /**
   * Review 11-14 S5 — a return with no bill has no bill to copy the party's
   * GST facts from, so they come from the customer master (the customer IS
   * its ledger: cus_id = led_id), as a Sale Bill's do (applyCustomerSnapshot):
   * GSTIN, GST type, state, place of supply and the address. Only where the
   * client sent nothing, as fillFromBill fills. The place of supply is the
   * customer's state when that is a GST state code (fk_sr_pos_state); it sets
   * the supply nature, so an out-of-state customer's return is INTER and its
   * register row carries the GSTIN and the state.
   */
  private async fillFromCustomer(tx: Prisma.TransactionClient, body: DocRow): Promise<void> {
    const custId = body.srCustId as string | null | undefined;
    if (!custId || !isUuid(custId)) {
      return;
    }
    const [cus] = await tx.$queryRaw<
      {
        cus_name: string | null;
        cus_addr1: string | null;
        cus_addr2: string | null;
        cus_addr3: string | null;
        cus_city: string | null;
        cus_pin: string | null;
        cus_phone1: string | null;
        cus_gst_no: string | null;
        cus_gst_type: string | null;
        cus_state_code: string | null;
        cus_state_name: string | null;
        pos_ok: boolean;
      }[]
    >`
      SELECT c.cus_name, c.cus_addr1, c.cus_addr2, c.cus_addr3, c.cus_city, c.cus_pin, c.cus_phone1,
             c.cus_gst_no, c.cus_gst_type, c.cus_state_code, c.cus_state_name,
             EXISTS (SELECT 1 FROM fixed.state_codes s WHERE s.state_code = c.cus_state_code) AS pos_ok
        FROM sales.customers c
       WHERE c.cus_id = ${custId}::uuid`;
    if (!cus) {
      return;
    }
    const text = (v: string | null | undefined): string | null => (v ?? '').trim() || null;
    const addr = [cus.cus_addr1, cus.cus_addr2, cus.cus_addr3]
      .map((a) => text(a))
      .filter((a): a is string => !!a)
      .join(', ');
    const stcd = text(cus.cus_state_code);
    for (const [k, v] of [
      ['srCustName', text(cus.cus_name)],
      ['srCustAddr', addr || null],
      ['srCustPlace', text(cus.cus_city)],
      ['srCustPin', text(cus.cus_pin)],
      ['srCustPhone', text(cus.cus_phone1)],
      ['srCustGstin', text(cus.cus_gst_no)],
      ['srCustGstType', text(cus.cus_gst_type)],
      ['srCustStcd', stcd],
      ['srPosStcd', cus.pos_ok ? stcd : null],
      ['srStateName', text(cus.cus_state_name)],
    ] as const) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        body[k] = v;
      }
    }
  }

  /** Writes the money onto the body /create (and /amend) saves: header, lines, charge rows. */
  private async applyMoneyToBody(
    tx: Prisma.TransactionClient,
    body: DocRow,
    items: DocRow[],
    money: ReturnMoney,
  ): Promise<void> {
    Object.assign(body, headerFieldsOf(money), { srAgentCommAmt: agentCommOf(money) });
    const claim = ((body.srReturnKind as string | null) ?? 'RETURN').toUpperCase() === 'CLAIM';
    body.items = items.map((item, i) => ({
      ...item,
      ...lineFieldsOf(money.lines[i], item, (body.srPriceLevel as number | null) ?? null),
      ...claimFieldsOf(item, claim),
    }));
    body.charges = chargeRowsOf(
      money,
      await this.storedChargeIds(tx, body.srId as string | undefined),
    );
  }

  /**
   * D77 — while an approval request of the return is PENDING the return does
   * not change (a save) or go away (a delete, which would strand the request
   * in the approvers' inbox): withdraw it first.
   */
  private async assertNoPendingApproval(tx: Prisma.TransactionClient, srId: string): Promise<void> {
    const pending = (await this.reader.approvalsOf(tx, srId)).find((a) => a.status === 'PENDING');
    if (pending) {
      throwSalesLocked(
        `This return waits for approval (${pending.event}, requested ${pending.requestedOn?.toISOString() ?? ''}): ` +
          'withdraw the request (/till/approvals/cancel) to change it',
        SALES_ERROR_CODES.RETURN_APPROVAL_PENDING,
        'srId',
        { status: pending.status },
      );
    }
  }

  /**
   * What a saved return already says: its customer (N8 — written once, at
   * create), the calc modes it was saved with (D20) and its settle mode.
   * null for an id that names no live return.
   */
  private async savedFacts(c: Prisma.TransactionClient, srId: string): Promise<SavedFacts | null> {
    if (!isUuid(srId)) {
      return null;
    }
    const [r] = await c.$queryRaw<
      { cust: string | null; f: string | null; l: string | null; m: string | null }[]
    >`
      SELECT sr_cust_id AS cust, sr_freight_calc_type AS f, sr_loading_calc_type AS l, sr_settle_mode AS m
        FROM sales.sale_return
       WHERE sr_id = ${srId}::uuid AND sr_is_deleted = false`;
    return r ? { custId: r.cust, freight: r.f, loading: r.l, settleMode: r.m } : null;
  }

  /** cd_src_cd_id → the return's own cd_id, so a re-save updates its rows. */
  private async storedChargeIds(
    tx: Prisma.TransactionClient,
    srId: string | undefined,
  ): Promise<Map<string, string>> {
    const rows = await this.reader.returnCharges(tx, srId);
    return new Map(rows.filter((r) => r.cdSrcCdId).map((r) => [r.cdSrcCdId as string, r.cdId]));
  }

  /**
   * The DRAFT upsert with the money worked out (create, and amend's re-save).
   * It files no audit row: the caller writes the save's ONE revision
   * (writeRevision) once everything it does is written.
   */
  private async saveBody(
    tx: Prisma.TransactionClient,
    dto: SaveSaleReturnDto,
    actor: string,
    now: Date,
    ms: MoneySettings,
    /**
     * /amend's re-save of a POSTED return: its PENDING review was withdrawn
     * by the amend itself (S4), so D77's freeze — a DRAFT's — does not apply.
     */
    opts: { amend?: boolean } = {},
  ): Promise<DocRow> {
    const body: DocRow = { ...(dto as unknown as DocRow) };
    // D77 — a request PENDING with an approver freezes a DRAFT: withdraw it to change it.
    if (dto.srId && !opts.amend) {
      await this.assertNoPendingApproval(tx, dto.srId);
    }
    const savedRow = dto.srId ? await this.savedFacts(tx, dto.srId) : null;
    // A re-save that names no customer is still the saved one's: its no-bill
    // rate (D56) and GST facts (S5) are that customer's.
    if ((body.srCustId === undefined || body.srCustId === null) && savedRow?.custId) {
      body.srCustId = savedRow.custId;
    }
    await this.fillFromBill(tx, body);
    // N8 — a saved return keeps its customer (sr_cust_id is written once, at
    // create): a re-save naming another customer, or a bill of another
    // customer, would work the money out on one party and book it on another.
    if (
      savedRow?.custId &&
      typeof body.srCustId === 'string' &&
      body.srCustId !== '' &&
      body.srCustId !== savedRow.custId
    ) {
      const viaBill = body.srIsAgainstBill !== false && !!body.srBillId;
      throwSalesRefused(
        viaBill
          ? `Bill ${(body.srBillRefno as string | null) ?? (body.srBillId as string)} belongs to another customer: a saved return keeps the customer it was saved with`
          : 'A saved return keeps the customer it was saved with: start a new return for another customer',
        SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED,
        viaBill ? 'srBillId' : 'srCustId',
      );
    }
    // A save that sends no lines (or no charges) keeps the stored ones — and
    // the money is still worked out from them, never from nothing.
    const stored =
      dto.srId && (dto.items === undefined || dto.charges === undefined)
        ? await this.store.find(tx, {
            id: dto.srId,
            companyId: dto.srCompanyId,
            branchId: dto.srBranchId,
            accYear: dto.srAccYear,
          })
        : null;
    const items = (
      dto.items !== undefined
        ? (dto.items as unknown as DocRow[])
        : stored
          ? await this.store.loadItems(tx, stored)
          : []
    ).map((i, idx) => ({
      ...i,
      sriLineNo: (i.sriLineNo as number | null | undefined) ?? idx + 1,
    }));
    const asks =
      dto.charges !== undefined || !stored
        ? chargeAsksOfBody(dto.charges as unknown as Record<string, unknown>[] | undefined)
        : chargeAsksOfStored(await this.reader.returnCharges(tx, dto.srId));
    const money = await this.moneyOf(
      tx,
      { ...body, srReturnDate: body.srReturnDate ?? stored?.srReturnDate ?? isoToday() },
      items,
      asks,
      ms,
      // N2 / D20 — a saved return keeps the calc mode it was saved with, as
      // /validate and /post read it; only a first save takes today's.
      calcOf(savedRow, ms),
    );
    await this.applyMoneyToBody(tx, body, items, money);
    // D4 — a new return with no settle mode starts from the branch's default.
    if (!dto.srId && (body.srSettleMode === undefined || body.srSettleMode === null)) {
      const due = money.bill ? await this.reader.billDue(tx, money.bill) : ZERO;
      body.srSettleMode = defaultSettleMode(ms.settleDefault, {
        adjustable: !!money.bill && money.bill.branchId === (body.srBranchId as string),
        billDue: due,
      });
    }
    return this.store.saveDraft(tx, body, actor, now, {
      revision: true,
      beforeWrite: (data) => {
        if (data.srReturnDatetime === undefined) {
          data.srReturnDatetime = now;
        }
      },
      // D16 — the device's own series, taken at the first save (D43).
      numberFor: () =>
        allocateSaleReturnNumber(tx, {
          companyId: body.srCompanyId as string,
          branchId: body.srBranchId as string,
          accYear: body.srAccYear as string,
          deviceId: body.srDeviceId as string,
        }),
    });
  }

  // ── create / get / delete / bill-lines ───────────────────────────────────

  async save(dto: SaveSaleReturnDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    const ms = await this.moneySettings(dto.srCompanyId, dto.srBranchId, dto.srDeviceId);
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = dto.srId
        ? await tx.$queryRaw<
            { sr_id: string; sr_company_id: string; sr_branch_id: string; sr_acc_year: string }[]
          >`
            SELECT sr_id, sr_company_id, sr_branch_id, sr_acc_year FROM sales.sale_return
             WHERE sr_id = ${dto.srId}::uuid AND sr_is_deleted = false`
        : [];
      await this.assertRight(existing.length > 0 ? 'edit' : 'create', tx);
      // Notes 89 — the return as /get answers it before this save (none on a create).
      const before = existing[0]
        ? await this.documentOf(tx, {
            id: existing[0].sr_id,
            companyId: existing[0].sr_company_id,
            branchId: existing[0].sr_branch_id,
            accYear: existing[0].sr_acc_year.trim(),
          })
        : null;
      const saved = await this.saveBody(tx, dto, actor, now, ms);
      await this.writeRevision(
        tx,
        this.store.keysOf(saved),
        before,
        actor,
        before ? 'Sale return updated' : 'Sale return created',
      );
      return saved;
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const rights = await this.assertRight('view', c);
    return { ...(await this.documentOf(c, keys)), rights };
  }

  /**
   * The return as /get answers it, less the caller's rights — read through
   * `c`, so a save or an amend can read its own uncommitted writes for the
   * revision it files (writeRevision).
   */
  private async documentOf(
    c: Prisma.TransactionClient,
    keys: DocKeys,
  ): Promise<Record<string, unknown>> {
    const row = await this.store.findOrThrow(c, keys);
    const [items, chargeRows, carry, tenders, transport, gdrId, cnApplied, approvals, note] =
      await Promise.all([
        this.store.loadItems(c, row),
        this.store.loadCharges(row, c),
        this.reader.returnCharges(c, keys.id),
        this.store.loadTenders(row, c),
        this.store.loadTransport(c, row),
        this.register.registerIdOf(c, keys.id, keys.accYear),
        this.creditApplied(c, row),
        this.reader.approvalsOf(c, keys.id),
        c.$queryRaw<{ pending: Prisma.Decimal | null }[]>`
        SELECT abl_pending_amount AS pending FROM accounts.acc_bill_balance
         WHERE abl_src_doc_type = 'SALE_RETURN' AND abl_src_doc_id = ${keys.id}::uuid
           AND abl_acc_year = ${keys.accYear}::char(9) AND abl_is_deleted = false
         LIMIT 1`,
      ]);
    // The bill charge each row gives back, and how (PRORATA · MANUAL · NONE = unticked).
    const carryById = new Map(carry.map((r) => [r.cdId, r]));
    const charges = chargeRows.map((ch) => {
      const k = carryById.get(ch.cdId);
      return {
        ...ch,
        cdSrcCdId: k?.cdSrcCdId ?? null,
        cdSrcAccYear: k?.cdSrcAccYear ?? null,
        cdCarryBasis: k?.cdCarryBasis ?? null,
        giveBack: k ? k.cdCarryBasis !== 'NONE' : null,
      };
    });
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
    // The names each line shows (additive, like /bills/get's sbiItemName /
    // sbiUnitName / sbiGodownName): a no-bill return reloads with them.
    const names = await this.reader.lineNames(
      c,
      items.map((i) => ({
        itemId: i.sriItemId,
        itemUnitId: i.sriItemUnitId,
        godownId: i.sriGodownId,
      })),
    );
    return {
      ...this.store.plain(row),
      // Textile addendum 2 E3.3 — each line's batch size / colour / model.
      items: await withBatchDetails(
        c,
        row.srCompanyId as string,
        'sri',
        items.map((i) => ({
          ...this.store.plain(i),
          sriItemName: names.items.get(i.sriItemId as string) ?? null,
          sriUnitName: names.units.get(i.sriItemUnitId as string) ?? null,
          sriGodownName: names.godowns.get(i.sriGodownId as string) ?? null,
        })),
      ),
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
      // D77 — a request PENDING with an approver freezes a DRAFT (review
      // 11-14 S4: a POSTED return's post-hoc review does not stop /amend,
      // which withdraws it; a posted document is not editable anyway).
      locks:
        row.srStatus === 'DRAFT' && approvals.some((a) => a.status === 'PENDING')
          ? { ...locks, editable: { ...locks.editable, document: false } }
          : locks,
      // D55 / D61 / D73 — every request filed for it, newest first.
      approvals: approvals.map((a) => ({
        tapId: a.tapId,
        tapAccYear: a.accYear,
        event: a.event,
        status: a.status,
        amount: n(a.amount),
        requestedBy: a.requestedByName ?? a.requestedBy,
        requestedOn: a.requestedOn?.toISOString() ?? null,
        requestNote: a.requestNote,
        decidedBy: a.decidedByName ?? a.decidedBy,
        decidedOn: a.decidedOn?.toISOString() ?? null,
        decisionNote: a.decisionNote,
        used: !!a.usedOn,
      })),
      // What is left of the credit note for a bill's F4 / a receipt (null on a
      // draft). A POSTED return with no note row (a 0.00 note, B1) holds 0.
      creditLeft: note[0] ? n(D(note[0].pending ?? 0)) : row.srStatus === 'POSTED' ? 0 : null,
    };
  }

  /**
   * Notes 89, as the Sales Order does (sale-order.service writeRevision) — the
   * ONE audit row of a save or an amend: the whole return AFTER it, read
   * through the same transaction in the /get shape, beside the `before` the
   * caller read first (null on a create). log_rev_no counts them per return
   * on screen 101 'Sale Return', so History › Revisions counts the saves.
   * Status steps (post, cancel, delete) stay plain audit rows, no revision.
   */
  private async writeRevision(
    tx: Prisma.TransactionClient,
    keys: DocKeys,
    before: Record<string, unknown> | null,
    actor: string,
    notes: string,
  ): Promise<number> {
    const after = await this.documentOf(tx, keys);
    const { revNo } = await this.audit.logDocumentRevision(
      {
        screenName: SR_SPEC.screenName,
        tableName: SR_SPEC.tableName,
        docId: keys.id,
        displayName: (after.srReturnRefno as string | null) || keys.id,
        before: before === null ? null : auditRecordOf(before),
        after: auditRecordOf(after),
        userId: actor,
        branchId: keys.branchId,
        deviceId: (after.srDeviceId as string | null) ?? null,
        notes,
      },
      tx,
    );
    return revNo;
  }

  async delete(dto: SaleReturnKeysDto): Promise<{ srId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(async (tx) => {
      await this.assertRight('delete', tx);
      await this.assertNoPendingApproval(tx, dto.srId);
      await this.store.deleteDraft(tx, this.keys(dto), actor, new Date());
    }, TX);
    return { srId: dto.srId, deleted: true };
  }

  /**
   * §6.1 / §6.2 — `GET /sale-returns/bill-lines`: the bill, every line with
   * its full money set and what is left in base units, every charge row.
   * The bill must be POSTED, in the return's company, and in its branch
   * unless `allBranches` (D14).
   */
  async billLines(q: SaleReturnBillLinesQueryDto): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    await this.assertRight('view', c);
    const accYear = q.sbAccYear.trim();
    const bill = await this.reader.billHeader(c, q.sbId, accYear);
    if (
      !bill ||
      bill.companyId !== q.companyId ||
      (!q.allBranches && bill.branchId !== q.branchId)
    ) {
      throwSalesNotFound(
        'Bill not found',
        'sbId',
        `No bill ${q.sbId} (${accYear}) in this ${bill && bill.companyId === q.companyId ? 'branch — tick All branches' : 'company'}`,
        SALES_ERROR_CODES.NOT_FOUND,
      );
    }
    if (bill.status !== 'POSTED') {
      throwSalesRefused(
        `Bill ${bill.refno ?? bill.sbId} is ${bill.status}: only a posted bill takes a return`,
        SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED,
        'sbId',
      );
    }
    const exclude = q.srId ?? null;
    // A POSTED return on screen (its amend) is left out of the bill's due as
    // well: what its own Adjust at Post set off comes back, as its unwind will.
    const unwound = await this.reader.unwindAddBack(c, exclude);
    const [lines, prior, drafts, charges, tenders, due, priorHeader, receivedLater] =
      await Promise.all([
        this.reader.billLines(c, bill),
        this.reader.priorBack(c, bill, exclude),
        this.reader.onDrafts(c, bill, exclude),
        this.reader.billCharges(c, bill, exclude),
        this.reader.billTenders(c, bill),
        this.reader.billDue(c, bill, unwound?.bills),
        this.reader.priorHeader(c, bill, exclude),
        this.reader.receivedLater(c, bill),
      ]);
    const itemIds = lines.map((l) => l.itemId);
    const [itemUnits, barcodes] = await Promise.all([
      this.reader.itemUnits(c, itemIds),
      this.reader.barcodes(c, itemIds),
    ]);
    const zero = { qtyBase: ZERO, weight: ZERO, value: ZERO };
    const chargeRows = mirrorCharges({
      charges,
      asks: new Map(),
      billBasis: zero,
      returnBasis: zero,
      emptiesBill: false,
      manual: { freight: false, loading: false },
      defaultGiveBack: true,
    }).map((ch) => {
      const j = chargeJson(ch);
      // Nothing is being returned yet: the panel's starting row.
      return {
        cdId: j.cdSrcCdId,
        accYear: j.cdSrcAccYear,
        chgId: j.chgId,
        name: j.name,
        type: j.type,
        kind: j.kind,
        sign: j.sign,
        role: j.role,
        method: j.method,
        basis: j.basis,
        beforeTax: j.beforeTax,
        sepPost: j.sepPost,
        taxApl: j.taxApl,
        ledgerId: j.ledgerId,
        ledgerName: j.ledgerName,
        locked: j.locked,
        onBill: j.onBill,
        onBillGst: j.onBillGst,
        backBefore: j.backBefore,
        left: j.cap,
      };
    });
    return billLinesJson({
      bill,
      lines,
      prior,
      drafts,
      itemUnits,
      barcodes,
      charges: chargeRows,
      tenders,
      due,
      receivedLater,
      // D3 / D48 — money paid on the bill (at the counter, and by Receipts
      // allocated to it since: user 11-13), less what earlier returns refunded.
      refundCap: Prisma.Decimal.max(
        ZERO,
        tenders.money.plus(receivedLater).minus(priorHeader.refund),
      ),
    });
  }

  // ── validate / post ──────────────────────────────────────────────────────

  async validate(dto: ValidateSaleReturnDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.srCompanyId, branchId: dto.srBranchId, deviceId: dto.srDeviceId },
      SR_SPEC.menuId,
    );
    if (!ctx.rights.create) {
      throwSalesRight('This user may not create on this menu', SALES_ERROR_CODES.RIGHT_CREATE);
    }
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
    const ms = await this.moneySettings(
      dto.srCompanyId,
      dto.srBranchId,
      dto.srDeviceId,
      ctx.settings,
    );
    const preview = await this.prisma.$transaction(async (tx) => {
      // The till session is server-owned (see SR_SERVER_OWNED): a client's id
      // tells the gate preview nothing.
      const body: DocRow = { ...(dto as unknown as DocRow), srSessionId: null };
      // A saved return keeps the calc mode it was saved with (D20), read as
      // /create's re-save and /post read it (calcOf), and its customer (N8).
      const saved = dto.srId ? await this.savedFacts(tx, dto.srId) : null;
      if ((body.srCustId === undefined || body.srCustId === null) && saved?.custId) {
        body.srCustId = saved.custId;
      }
      await this.fillFromBill(tx, body);
      // N8 — what /create would refuse, said here first.
      if (
        saved?.custId &&
        typeof body.srCustId === 'string' &&
        body.srCustId !== '' &&
        body.srCustId !== saved.custId
      ) {
        const viaBill = body.srIsAgainstBill !== false && !!body.srBillId;
        refuse(
          g,
          SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED,
          viaBill
            ? 'This bill belongs to another customer: a saved return keeps the customer it was saved with'
            : 'A saved return keeps the customer it was saved with: start a new return for another customer',
          { field: viaBill ? 'srBillId' : 'srCustId' },
        );
      }
      const money = await this.moneyOf(
        tx,
        body,
        items,
        chargeAsksOfBody(dto.charges as unknown as Record<string, unknown>[] | undefined),
        ms,
        calcOf(saved, ms),
      );
      // The preview of an amend: `srId` names a POSTED return, which the amend
      // unwinds before it works anything out. The money above already leaves
      // it out (priorBack / priorHeader exclude it by id); the bills it set
      // off and the customer's balance are put back as the unwind will leave
      // them. null for a draft or a first post.
      const unwound = await this.reader.unwindAddBack(tx, dto.srId);
      const mode =
        (body.srSettleMode as string | null | undefined) ??
        saved?.settleMode ??
        defaultSettleMode(ms.settleDefault, {
          adjustable: !!money.bill && money.bill.branchId === dto.srBranchId,
          billDue: money.bill ? await this.reader.billDue(tx, money.bill, unwound?.bills) : ZERO,
        });
      body.srSettleMode = mode;
      const verdict = await this.guards(tx, body, items, ctx, g, money);
      const plan = await buildSettlement(this.reader, tx, money, {
        mode,
        companyId: dto.srCompanyId,
        branchId: dto.srBranchId,
        custId: (body.srCustId as string | null) ?? null,
        tenders: await this.refundTendersOf(tx, (dto.tenders ?? []) as unknown as DocRow[]),
        adjustments: adjustAsksOf(dto.adjustments),
        billSort: ms.billSort,
        lock: false,
        unwound,
      });
      for (const issue of plan.issues) {
        this.raise(g, issue);
      }
      // D45 — a total the screen shows that the server no longer agrees with.
      if (
        dto.srReturnAmt !== undefined &&
        dto.srReturnAmt !== null &&
        !D(dto.srReturnAmt).equals(money.totals.creditNote)
      ) {
        refuse(
          g,
          SALES_ERROR_CODES.AMOUNT_MISMATCH,
          `The return now comes to ${money.totals.creditNote.toString()}, not the ${String(dto.srReturnAmt)} sent — refresh the figures`,
          { field: 'srReturnAmt' },
        );
      }
      const asks = this.gateAsks(body, money, plan, ctx, dto.approvalIds ?? {});
      const approvals = await this.gatePreview(
        tx,
        asks,
        (body.srId as string | null) ?? null,
        unwound !== null,
      );
      return {
        ...previewOf(
          money,
          items,
          ((body.srReturnKind as string | null) ?? 'RETURN').toUpperCase() === 'CLAIM',
        ),
        ...this.extrasJson(plan),
        gstMode: verdict.financial ? 'FINANCIAL' : 'GST',
        cutoffPassed: verdict.cutoffPassed,
        settlement: settlementJson(plan),
        approvals,
      };
    }, TX);
    return {
      ok: g.refusals.length === 0,
      refusals: g.refusals,
      warnings: g.warnings,
      rights: ctx.rights,
      preview,
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
      // Popup B's rows, written over the draft's before anything reads them.
      if (dto.tenders !== undefined) {
        await this.writeRefundTenders(tx, row, dto.tenders as unknown as DocRow[]);
      }
      await this.dropRefundRowsUnlessCash(tx, row);
      await this.tillForPost(tx, row, ctx);
      fire = await this.postPipeline(tx, row, ctx, {
        overrides: dto.overrides ?? [],
        adjustments: dto.adjustments,
        approvalIds: dto.approvalIds ?? {},
        now: new Date(),
        revisionNo: undefined,
        title: 'Sale return cannot be posted',
      });
    }, TX);
    if (fire) {
      this.gst.enqueueAfterPost(fire);
    }
    return this.get(this.keys(dto));
  }

  /**
   * The post, after the row is locked and its rights checked — shared by
   * /post and /amend's re-post: lock the bill and work the money out again
   * (D45 / D51), the guards, the settlement (D35), the gate (D26 / D67), then
   * write and post.
   */
  private async postPipeline(
    tx: Prisma.TransactionClient,
    row0: DocRow,
    ctx: SalesCallContext,
    opts: {
      overrides: string[];
      adjustments: PostSaleReturnDto['adjustments'];
      approvalIds: Record<string, string>;
      now: Date;
      revisionNo: number | undefined;
      title: string;
      /**
       * The total the screen showed (/amend's srReturnAmt): one the money no
       * longer comes to is refused as stale, as /validate refuses it (N1).
       */
      expectReturnAmt?: string | number | null;
    },
  ): Promise<{ gdrId: string | null; einvoice: boolean; ewaybill: boolean } | null> {
    let row = row0;
    const mode = ((row.srSettleMode as string | null) ?? 'ADJUST').toUpperCase();
    const { items, money, ms } = await this.lockAndWorkOut(tx, row, ctx);
    const g = createGuardContext({
      overrides: opts.overrides,
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
    });
    const verdict = await this.guards(tx, row, items, ctx, g, money);
    this.refuseStale(g, row, money);
    // Review 11-14 N1 — the amend re-works the money (D45); a figure the
    // operator saw that it no longer agrees with is not posted unseen.
    if (
      opts.expectReturnAmt !== undefined &&
      opts.expectReturnAmt !== null &&
      opts.expectReturnAmt !== '' &&
      !D(opts.expectReturnAmt).equals(money.totals.creditNote)
    ) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `The return now comes to ${money.totals.creditNote.toString()}, not the ${String(opts.expectReturnAmt)} sent — refresh the figures`,
        { field: 'srReturnAmt' },
      );
    }
    const refundRows = mode === 'CASH' ? await this.store.loadTenders(row, tx) : [];
    const plan = await buildSettlement(this.reader, tx, money, {
      mode,
      companyId: row.srCompanyId as string,
      branchId: row.srBranchId as string,
      custId: (row.srCustId as string | null) ?? null,
      tenders: refundTendersFromRows(refundRows),
      adjustments: adjustAsksOf(opts.adjustments),
      billSort: ms.billSort,
      lock: true,
      // The live state: a first post has nothing to unwind, and /amend has
      // already unwound (its set-offs are back on the bills) — adding back
      // here would count them twice.
      unwound: null,
    });
    // The world moved under popup 25: 409, open it again (§5.10).
    const stale = plan.issues.find((i) => i.code === SALES_ERROR_CODES.RETURN_ADJUST_STALE);
    if (stale) {
      throwSalesLocked(stale.message, stale.code, stale.field ?? 'adjustments');
    }
    for (const issue of plan.issues) {
      this.raise(g, issue);
    }
    if (g.refusals.length > 0) {
      throwSalesRefusals(opts.title, g.refusals);
    }
    // D26 / D67 — the gate: under REFUSE nothing moves until approved (428).
    const asks = await this.withLatestApprovals(
      tx,
      this.gateAsks(row, money, plan, ctx, opts.approvalIds),
      row.srId as string,
    );
    const verdicts: { ask: GateAsk; verdict: GateVerdict }[] = [];
    for (const ask of asks) {
      const v = await this.approvals.assessGate(tx, ask);
      if (v.state === 'REFUSE') {
        this.approvals.throwApprovalRequired(v.need, ask);
      }
      verdicts.push({ ask, verdict: v });
    }
    if (verdict.financial) {
      row = { ...row, srGstMode: 'FINANCIAL' };
    }
    const fresh = await this.writeMoney(tx, row, items, money);
    const fire = await this.postCore(
      tx,
      fresh.row,
      fresh.items,
      ctx,
      opts.now,
      'DRAFT',
      opts.revisionNo,
      money,
      plan,
    );
    // An approved request is taken; under WARN a review is filed (D67). Not
    // written into the status trail (D72).
    for (const { ask, verdict: v } of verdicts) {
      await this.approvals.settleGate(tx, ask, v);
    }
    return fire;
  }

  /**
   * D51 — the post locks every line of the bill (and its charge rows) in id
   * order, THEN reads what the other posted returns took: two counters
   * posting returns of one bill serialise here, so neither over-returns a
   * line and the one that empties the bill sees it empty. Then the money is
   * worked out again (D45) from the return's saved lines.
   */
  private async lockAndWorkOut(
    tx: Prisma.TransactionClient,
    row: DocRow,
    ctx: SalesCallContext,
  ): Promise<{ items: DocRow[]; money: ReturnMoney; ms: MoneySettings }> {
    if (row.srIsAgainstBill !== false && row.srBillId && row.srBillAccYear) {
      const bill = { sbId: row.srBillId as string, accYear: (row.srBillAccYear as string).trim() };
      await this.reader.lockBillLines(tx, bill);
      await this.reader.lockBillCharges(tx, bill);
    }
    const items = await this.store.loadItems(tx, row);
    const stored = await this.reader.returnCharges(tx, row.srId as string);
    const ms = await this.moneySettings(
      row.srCompanyId as string,
      row.srBranchId as string,
      row.srDeviceId as string | null,
      ctx.settings,
    );
    const money = await this.moneyOf(tx, row, items, chargeAsksOfStored(stored), ms, {
      freight: (row.srFreightCalcType as string | null) ?? ms.freightCalcType,
      loading: (row.srLoadingCalcType as string | null) ?? ms.loadingCalcType,
    });
    return { items, money, ms };
  }

  // ── the approval gate (D26 / D61 / D67 / D72 / D77) ─────────────────────

  /** Every event this return trips, each with the amount it is judged on. */
  private gateAsks(
    row: DocRow,
    money: ReturnMoney,
    plan: SettlementPlan,
    ctx: SalesCallContext,
    approvalIds: Record<string, string>,
  ): GateAsk[] {
    const events: { event: GateEvent; amount: Prisma.Decimal }[] = [
      { event: 'SALE_RETURN', amount: money.totals.creditNote },
    ];
    if (((row.srReturnKind as string | null) ?? 'RETURN').toUpperCase() === 'CLAIM') {
      events.push({ event: 'SALE_CLAIM', amount: money.totals.creditNote });
    }
    if (!money.bill) {
      events.push({ event: 'RETURN_NO_RECEIPT', amount: money.totals.creditNote });
    }
    if (plan.refund && plan.refund.cashOut.gt(0)) {
      events.push({ event: 'REFUND_CASH', amount: plan.refund.cashOut });
    }
    const deviceId = row.srDeviceId as string | null;
    return events.map(({ event, amount }) => ({
      companyId: row.srCompanyId as string,
      branchId: row.srBranchId as string,
      tenantId: (row.srTenantId as string | null) ?? null,
      accYear: row.srAccYear as string,
      event,
      onDate: isoDate(row.srReturnDate as Date | string | null) ?? isoToday(),
      amount: amount.toDecimalPlaces(2),
      requesterId: ctx.actor,
      deviceId: isUuid(deviceId) ? deviceId : null,
      sessionId: isUuid(row.srSessionId as string | null) ? (row.srSessionId as string) : null,
      counterId: isUuid(row.srCounterId as string | null) ? (row.srCounterId as string) : null,
      // grids 207 / 209 read the request by these two (P1).
      srcDocType: 'SALE_RETURN',
      srcDocId: (row.srId as string | undefined) ?? '00000000-0000-0000-0000-000000000000',
      srcRefno: (row.srReturnRefno as string | null) ?? null,
      approvalId: approvalIds[event] ?? null,
      field: 'approvalIds',
    }));
  }

  /**
   * An event the client brings no approval for takes the latest APPROVED,
   * unused one of this return — only one approved for at least the amount the
   * event is judged on now (review 11-14 S2). A claim whose amount grew after
   * it was approved attaches none, so the gate asks again (428 under REFUSE,
   * a review filed under WARN) instead of refusing the smaller approval
   * (TILL_APPROVAL_INVALID) on every post for ever.
   */
  private async withLatestApprovals(
    c: Prisma.TransactionClient,
    asks: GateAsk[],
    srId: string | null,
  ): Promise<GateAsk[]> {
    const rows = await this.reader.approvalsOf(c, srId);
    return asks.map((a) => {
      if (a.approvalId) {
        return a;
      }
      const ok = rows.find(
        (r) =>
          r.event === a.event && r.status === 'APPROVED' && !r.usedOn && D(r.amount).gte(a.amount),
      );
      return ok ? { ...a, approvalId: ok.tapId } : a;
    });
  }

  /** `preview.approvals[]`: each event's state — NONE · WARN · REFUSE · APPROVED · PENDING · REJECTED. */
  private async gatePreview(
    c: Prisma.TransactionClient,
    asks: GateAsk[],
    srId: string | null,
    /**
     * The preview of an amend of a POSTED return (S4): the amend withdraws
     * every PENDING review first, so a PENDING row says nothing about it —
     * the state is what its own gate will answer.
     */
    pendingWithdrawn = false,
  ): Promise<Record<string, unknown>[]> {
    const rows = (await this.reader.approvalsOf(c, srId)).filter(
      (r) => !(pendingWithdrawn && r.status === 'PENDING'),
    );
    const withIds = await this.withLatestApprovals(c, asks, srId);
    const out: Record<string, unknown>[] = [];
    for (const ask of withIds) {
      const latest = rows.find((r) => r.event === ask.event);
      let verdict: GateVerdict | { state: 'INVALID'; message: string };
      try {
        verdict = await this.approvals.assessGate(c, ask);
      } catch (e) {
        verdict = { state: 'INVALID', message: e instanceof Error ? e.message : String(e) };
      }
      const need = 'need' in verdict ? verdict.need : null;
      const state =
        latest?.status === 'PENDING'
          ? 'PENDING'
          : latest?.status === 'REJECTED' && verdict.state !== 'APPROVED'
            ? 'REJECTED'
            : verdict.state;
      if (verdict.state === 'NONE' && !latest) {
        continue;
      }
      out.push({
        event: ask.event,
        state,
        amount: n(ask.amount),
        need: need
          ? {
              threshold: n(new Prisma.Decimal(need.threshold)),
              minRole: need.minRole,
              channel: need.channel,
              twoPerson: need.twoPerson,
              enforced: need.enforced ?? false,
            }
          : null,
        tapId: latest?.tapId ?? ask.approvalId ?? null,
        tapAccYear: latest?.accYear ?? null,
        requestedOn: latest?.requestedOn?.toISOString() ?? null,
        decidedBy: latest?.decidedByName ?? null,
        decidedOn: latest?.decidedOn?.toISOString() ?? null,
        decisionNote: latest?.decisionNote ?? null,
        ...(verdict.state === 'INVALID' ? { message: verdict.message } : {}),
      });
    }
    return out;
  }

  // ── refund rows ───────────────────────────────────────────────────────────

  /** Popup B's rows onto the draft (CR tenders), as /create writes them. */
  private async writeRefundTenders(
    tx: Prisma.TransactionClient,
    row: DocRow,
    tenders: DocRow[],
  ): Promise<void> {
    await this.tenderDetail.syncDocumentTenders(
      tx,
      {
        tdSrcModule: TenderSrcModule.SALES,
        tdSrcDocType: TenderSrcDocType.SALE_RETURN,
        tdSrcDocId: row.srId as string,
        tdCompanyId: row.srCompanyId as string,
        tdBranchId: row.srBranchId as string,
        tdTenantId: (row.srTenantId as string | null) ?? null,
        tdAccYear: row.srAccYear as string,
        tdDocDate: row.srReturnDate as Date,
        tdPartyLedgerId: (row.srCustId as string | null) ?? null,
        tdUserId: row.srUserId as string,
        tdSessionId: (row.srSessionId as string | null) ?? null,
        tdDeviceId: (row.srDeviceId as string | null) ?? null,
        tdDrCr: TenderDrCr.CR,
      },
      tenders,
      this.salesContext.actor(),
      {
        tableName: 'acc_tender_detail',
        screenName: 'Sale Return',
        entityName: 'Sale Return tender',
      },
    );
  }

  /**
   * Review 11-14 S1 — only a Refund (CASH) pays out through tender rows. A
   * return posted, or re-posted by /amend, as Adjust or Credit note drops the
   * refund rows an earlier save or post left on it: tillForPost stamps every
   * live row into the drawer's session and the till ledger counts each as
   * cash out, while the books would carry none.
   */
  private async dropRefundRowsUnlessCash(tx: Prisma.TransactionClient, row: DocRow): Promise<void> {
    const mode = ((row.srSettleMode as string | null) ?? 'ADJUST').toUpperCase();
    if (mode === 'CASH') {
      return;
    }
    const live = await this.store.loadTenders(row, tx);
    if (live.length > 0) {
      await this.writeRefundTenders(tx, row, []);
    }
  }

  /** A /validate body's refund rows, their tender type read off the master when the row says none. */
  private async refundTendersOf(
    c: Prisma.TransactionClient,
    rows: DocRow[],
  ): Promise<RefundTender[]> {
    const missing = rows
      .filter((r) => (r.tdTenderTypeId === undefined || r.tdTenderTypeId === null) && r.tdTenderId)
      .map((r) => r.tdTenderId as string);
    const types = missing.length
      ? new Map(
          (
            await c.$queryRaw<{ tnd_id: string; tnd_type_id: number }[]>`
              SELECT tnd_id, tnd_type_id FROM accounts.acc_tender_master WHERE tnd_id = ANY(${missing}::uuid[])`
          ).map((t) => [t.tnd_id, Number(t.tnd_type_id)]),
        )
      : new Map<string, number>();
    return rows.map((r, index) => ({
      index,
      tenderId: (r.tdTenderId as string | null) ?? null,
      tenderTypeId:
        r.tdTenderTypeId !== undefined && r.tdTenderTypeId !== null
          ? Number(r.tdTenderTypeId)
          : (types.get(r.tdTenderId as string) ?? 0),
      amount: D(r.tdAmount as Prisma.Decimal.Value),
      refNo: (r.tdRefNo as string | null) ?? null,
    }));
  }

  /** The preview's P2b blocks beside the settlement (§6.2). */
  private extrasJson(plan: SettlementPlan): Record<string, unknown> {
    return {
      loyaltyReverse: { points: n(plan.loyaltyReverse) },
      pointsBack: {
        points: n(plan.shares.points),
        amount: n(plan.shares.pointsBackAmt),
        rate: n(plan.shares.rate),
        memberId: plan.memberId,
      },
      voucherShare: n(plan.shares.voucherShare),
      agentCommBack: n(plan.agentCommBack),
      promoCheck: plan.promoCheck.map((p) => ({
        schemeId: p.schemeId,
        kind: p.kind,
        keptValue: n(p.keptValue),
        text: p.text,
      })),
      customerBalance: plan.customerBalance
        ? { before: n(plan.customerBalance.before), after: n(plan.customerBalance.after) }
        : null,
    };
  }

  /** D45 / §6.3 step 3 — the saved draft's total against the money worked out now. */
  private refuseStale(g: SalesGuardContext, row: DocRow, money: ReturnMoney): void {
    const saved = D(row.srReturnAmt as Prisma.Decimal.Value);
    if (!saved.equals(money.totals.creditNote)) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `The return was saved at ${saved.toString()} but now comes to ${money.totals.creditNote.toString()} ` +
          '(another return of this bill posted, or the bill changed) — open it and save again',
        { field: 'srReturnAmt' },
      );
    }
  }

  /**
   * The money the post goes on, written back onto the lines and the charge
   * rows first, so what is stored is exactly what posts.
   */
  private async writeMoney(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    money: ReturnMoney,
  ): Promise<{ row: DocRow; items: DocRow[] }> {
    const priceLevel = (row.srPriceLevel as number | null) ?? null;
    const written: DocRow[] = [];
    for (let i = 0; i < items.length; i++) {
      written.push(
        await this.store.updateItem(
          tx,
          items[i],
          lineFieldsOf(money.lines[i], items[i], priceLevel),
        ),
      );
    }
    await this.chargeDetail.syncDocumentCharges(
      tx,
      {
        cdDocType: ChargeDocType.SALE_RETURN,
        cdDocId: row.srId as string,
        cdCompId: row.srCompanyId as string,
        cdBranchId: row.srBranchId as string,
        cdAccYear: row.srAccYear as string,
        cdVoucherNo: (row.srReturnSlno as bigint | null) ?? null,
      },
      chargeRowsOf(money, await this.storedChargeIds(tx, row.srId as string)),
      this.salesContext.actor(),
      {
        tableName: 'txn_charge_detail',
        screenName: 'Sale Return',
        entityName: 'Sale Return charge',
      },
    );
    return { row: { ...row, ...headerFieldsOf(money) }, items: written.length ? written : items };
  }

  /**
   * D7 / §5.5 — the till session a post (or an amend's re-post) moves money
   * in. A refund comes out of the drawer it is paid from, so on a counter's
   * device the return posts in THAT live session, whatever session the
   * original bill was in; notes 122 §5 judges the cash it takes out against
   * that drawer. Any other device posts in no session.
   *
   * The session comes from the posting device alone, never from the
   * document: /create drops a client-sent srSessionId (server-owned), and
   * nothing the row carries is taken as "the session it names".
   */
  private async tillForPost(
    tx: Prisma.TransactionClient,
    row: DocRow,
    ctx: SalesCallContext,
  ): Promise<void> {
    const mode = ((row.srSettleMode as string | null) ?? 'ADJUST').toUpperCase();
    const refundRows = mode === 'CASH' ? await this.store.loadTenders(row, tx) : [];
    const till = await this.till.resolveForMoney(tx, {
      companyId: row.srCompanyId as string,
      branchId: row.srBranchId as string,
      sessionId: null,
      field: 'srSessionId',
      // Notes 122 §5: a cash refund leaves the drawer.
      cashOut: refundRows
        .filter((t) => Number(t.tdTenderTypeId) === TENDER_TYPE.CASH)
        .reduce((sum, t) => sum.plus(t.tdAmount ?? 0), new Prisma.Decimal(0)),
    });
    if (till) {
      await this.stampTillSession(tx, row, till, ctx.actorName);
    } else if (row.srSessionId) {
      // An ungoverned device posts in no session: a row that still names one
      // (an earlier post's, or a draft saved before the id became
      // server-owned) does not carry it into these books.
      await this.clearTillSession(tx, row, ctx.actorName);
    }
  }

  /** No till session for this post: the header and its live tender rows name none. */
  private async clearTillSession(
    tx: Prisma.TransactionClient,
    row: DocRow,
    actorName: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE sales.sale_return
         SET sr_session_id = NULL, sr_modified_on = now(), sr_modified_by = ${actorName}
       WHERE sr_id = ${row.srId as string}::uuid
         AND sr_acc_year = ${row.srAccYear as string}::char(9)`;
    await tx.$executeRaw`
      UPDATE accounts.acc_tender_detail
         SET td_session_id = NULL, td_modified_on = now(), td_modified_by = ${actorName}
       WHERE td_src_doc_type = 'SALE_RETURN'
         AND td_src_doc_id   = ${row.srId as string}::uuid
         AND td_acc_year     = ${row.srAccYear as string}::char(9)
         AND td_is_deleted   = false
         AND td_session_id IS NOT NULL`;
    row.srSessionId = null;
  }

  /** The return and its live tender rows carry the till session and its counter (§7.4). */
  private async stampTillSession(
    tx: Prisma.TransactionClient,
    row: DocRow,
    till: LiveSessionRef,
    actorName: string,
  ): Promise<void> {
    if (row.srSessionId !== till.tssId || row.srCounterId !== till.tssCounterId) {
      await tx.$executeRaw`
        UPDATE sales.sale_return
           SET sr_session_id  = ${till.tssId}::uuid,
               sr_counter_id  = ${till.tssCounterId}::uuid,
               sr_modified_on = now(),
               sr_modified_by = ${actorName}
         WHERE sr_id = ${row.srId as string}::uuid
           AND sr_acc_year = ${row.srAccYear as string}::char(9)`;
      row.srSessionId = till.tssId;
      row.srCounterId = till.tssCounterId;
    }
    await this.till.stampTenderRows(
      tx,
      till,
      { srcDocType: 'SALE_RETURN', srcDocId: row.srId as string, accYear: row.srAccYear as string },
      actorName,
    );
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

  private async guards(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
    money: ReturnMoney,
  ): Promise<{ financial: boolean; cutoffPassed: boolean }> {
    let financial = false;
    let cutoffPassed = false;
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
        SALES_ERROR_CODES.CUSTOMER_REQUIRED,
        'A sale return must name a customer — the credit note is raised against the customer ledger',
        { field: 'srCustId' },
      );
    }
    if (!money.lines.some((l) => l.qty.gt(0))) {
      refuse(g, SALES_ERROR_CODES.RETURN_NO_LINES, 'No line of this return has a quantity', {
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

    // Items: allowed to return. A scheme's free item always comes back (D6).
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
    }

    const against = row.srIsAgainstBill !== false && row.srBillId;
    const bill = money.bill;
    if (against) {
      if (!bill || bill.status !== 'POSTED' || bill.companyId !== companyId) {
        refuse(
          g,
          SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED,
          'The bill this return is against is not a POSTED bill of this company',
          { field: 'srBillId' },
        );
      } else {
        const billDate = bill.date;
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
        // s.34(2): a credit note past the cut-off cannot be declared. D8 — it
        // can still be a FINANCIAL credit note (no GST cut, no IRN), but only
        // when the Override holder ticks SALES_RETURN_FINANCIAL: the CA has
        // not confirmed it (plan O1), so nothing takes this path by default.
        const cutoff = await this.statutory.creditNoteCutoff(companyId, billDate, docDate, tx);
        cutoffPassed = cutoff.passed;
        if (
          cutoff.passed &&
          ctx.rights.override &&
          g.overrides.includes(SALES_ERROR_CODES.RETURN_FINANCIAL)
        ) {
          financial = true;
        } else if (cutoff.passed && cutoff.limit) {
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
      }
    }

    // D23 — a claim line says Back or Destroyed at the shop.
    if (((row.srReturnKind as string | null) ?? 'RETURN').toUpperCase() === 'CLAIM') {
      money.lines.forEach((l, i) => {
        const goods = ((items[i]?.sriClaimGoods as string | null) ?? '').toUpperCase();
        if (l.qty.gt(0) && goods !== 'BACK' && goods !== 'DESTROYED') {
          refuse(
            g,
            SALES_ERROR_CODES.RETURN_CLAIM_GOODS,
            `Line ${l.lineNo}: a claim line must say BACK or DESTROYED (sriClaimGoods)`,
            { field: 'sriClaimGoods', line: l.lineNo },
          );
        }
      });
    }

    // The money's own findings: units, not on the bill, over qty, no-bill
    // rate, on other drafts, expired lots, a typed charge over its cap. The
    // settlement's (adjust, refund, scheme short) are raised by the caller.
    for (const issue of money.issues) {
      this.raise(g, issue);
    }
    // Review 11-14 B1 — a 0.00 note posts (stock + COGS only); a note below
    // nothing never does: a deduction it gives back (an after-tax DEDUCT on a
    // free line, the bill's cash discount left over) outweighs the goods.
    if (money.totals.creditNote.lt(0)) {
      refuse(
        g,
        SALES_ERROR_CODES.RETURN_NEGATIVE,
        `The return comes to ${money.totals.creditNote.toFixed(2)}: the deductions it gives back are more than the goods coming back`,
        { field: 'srReturnAmt', params: { value: money.totals.creditNote.toFixed(2) } },
      );
    }
    return { financial, cutoffPassed };
  }

  private raise(g: SalesGuardContext, issue: MoneyIssue): void {
    const opts = {
      field: issue.field,
      line: issue.line,
      ...(issue.params ? { params: issue.params } : {}),
    };
    if (issue.level === 'REFUSE') {
      refuse(g, issue.code, issue.message, opts);
    } else if (issue.level === 'WARN') {
      warn(g, issue.code, issue.message, opts);
    } else {
      info(g, issue.code, issue.message, opts);
    }
  }

  private async postCore(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    now: Date,
    fromStatus: string,
    revisionNo: number | undefined,
    money: ReturnMoney,
    plan: SettlementPlan,
  ) {
    const actor = ctx.actor;
    const keys = this.store.keysOf(row);
    const partyId = row.srCustId as string;
    const refno = (row.srReturnRefno as string) ?? keys.id;
    const docDate = isoDate(row.srReturnDate as Date) ?? isoToday();
    const t = money.totals;
    const returnAmt = t.creditNote;
    const financial = ((row.srGstMode as string | null) ?? 'GST') === 'FINANCIAL';
    const tenders = plan.refund ? await this.store.loadTenders(row, tx) : [];
    const company = await this.reader.company(tx, keys.companyId);
    const nature = money.nature;
    const byId = new Map(items.map((i) => [i.sriId as string, i]));

    // 1 · the goods come back — at the bill line's own cost per base unit
    //     (D54), today's average when the bill line had none (D69) or there is
    //     no bill line. The bucket follows the condition (D12); a claim line
    //     the shop destroyed brings no stock (D23).
    const claim = ((row.srReturnKind as string | null) ?? 'RETURN').toUpperCase() === 'CLAIM';
    const moving = money.lines
      .map((l, i) => ({ l, i: items[i] }))
      .filter(
        ({ l, i }) =>
          !!i && !(i.sriIsService as boolean) && l.qtyBase.gt(0) && bringsStock(i, claim),
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
        lines: moving.map(({ l, i }) => ({
          lineId: i.sriId as string,
          lineNo: i.sriLineNo as number,
          itemId: i.sriItemId as string,
          itemUnitId: i.sriItemUnitId as string,
          godownId: i.sriGodownId as string,
          lotId: i.sriLotId as string | null,
          // The condition decides (D12 / D23) — as /create stored it.
          bucket: lineBucketOf(i, claim),
          qty: num(i.sriReturnQty as Prisma.Decimal),
          freeQty: num(i.sriFreeQty as Prisma.Decimal),
          weightQty: i.sriWeightQty === null ? null : num(i.sriWeightQty as Prisma.Decimal),
          toBaseFactor: n(l.factor),
          batchNo: i.sriBatchNo as string | null,
          batchDate: isoDate(i.sriBatchDate as Date | null),
          expiryDate: isoDate(i.sriExpiryDate as Date | null),
          serialNo: i.sriSerialNo as string | null,
          mrp: i.sriMaxPrice === null ? null : num(i.sriMaxPrice as Prisma.Decimal),
          rate: num(i.sriRate as Prisma.Decimal),
          costRate:
            l.costPerBase && l.parts.cogsAmt.gt(0)
              ? n(r6(l.parts.cogsAmt.dividedBy(l.qtyBase)))
              : null,
          taxPerc: num(i.sriTaxPerc as Prisma.Decimal),
        })),
      },
      actor,
      now,
    );
    // What the engine booked per line IS the COGS taken back: the bill's share
    // where the line quoted it, the average elsewhere; nothing for a line that
    // brought no stock back.
    let cogsTotal = ZERO;
    const movedIds = new Set(moving.map(({ i }) => i.sriId as string));
    for (const i of items) {
      const id = i.sriId as string;
      const cost = movedIds.has(id) ? D(stock.costByLine.get(id) ?? 0) : ZERO;
      cogsTotal = cogsTotal.plus(cost);
      await this.store.updateItem(tx, byId.get(id) ?? i, {
        sriLotId: movedIds.has(id)
          ? (stock.lotByLine.get(id) ?? i.sriLotId ?? null)
          : (i.sriLotId ?? null),
        sriCogsAmt: cost,
      });
    }
    const cogs = ctx.cogsMode === 'PERPETUAL' ? cogsTotal : ZERO;

    // 2 · the legs — the bill's mirror. Charges signed (P0), with their own
    //     GST (gap 36); one inside the lines that posts separately takes its
    //     share back off its own ledger, as the bill grossed SALES up for it.
    //     A refund pays the customer out through its tenders; the points share
    //     goes back as points (D48: CR loyalty redemption, DR party).
    const legCharges = money.charges.filter(storesCharge).map((c) => ({
      ledgerId: c.bill.ledgerId,
      amount: n(signed(c, c.back.amount))!,
      cgst: n(signed(c, c.back.cgst))!,
      sgst: n(signed(c, c.back.sgst))!,
      igst: n(signed(c, c.back.igst))!,
      cess: n(signed(c, c.back.cess))!,
      taxId: c.bill.taxApl && !c.bill.beforeTax ? c.bill.taxCode : null,
      separatelyPosted: true,
      name: c.bill.name,
    }));
    const salesAmount = t.taxable.minus(
      money.charges
        .filter((c) => storesCharge(c) && (c.bill.beforeTax || c.bill.taxApl))
        .reduce((s, c) => s.plus(signed(c, c.back.amount)), ZERO),
    );
    const refundLegTenders = plan.refund
      ? tenders
          .filter(
            (td) => [1, 3, 6].includes(Number(td.tdTenderTypeId)) && D(td.tdAmount ?? 0).gt(0),
          )
          .map((td) => ({
            tenderTypeId: Number(td.tdTenderTypeId),
            tenderLedgerId: td.tdTenderLedgerId,
            amount: num(td.tdAmount),
            isLoyalty: false,
            isCredit: false,
            name: td.tdTenderName,
          }))
      : [];
    const pointsLeg = plan.shares.pointsBackAmt.gt(0)
      ? [
          {
            tenderTypeId: TENDER_TYPE.LOYALTY,
            tenderLedgerId: null,
            amount: n(plan.shares.pointsBackAmt)!,
            isLoyalty: true,
            isCredit: false,
            name: 'Points back',
          },
        ]
      : [];
    const built = buildReturnLegs({
      partyLedgerId: partyId,
      supplyNature: nature,
      salesAmount: n(salesAmount)!,
      taxes: bucketTaxes(
        money.lines.map((l) => ({
          taxId: l.copy?.taxId ?? null,
          cgst: n(l.parts.cgstAmt)!,
          sgst: n(l.parts.sgstAmt)!,
          igst: n(l.parts.igstAmt)!,
          cess: n(l.parts.cessAmt)!,
          acess: n(l.parts.acessAmt)!,
        })),
      ),
      charges: legCharges,
      cashDiscount: n(t.cashDisc)!,
      schemeDiscount: ctx.settings.postSchemeDiscSeparately ? n(t.schDisc.plus(t.billSchDisc))! : 0,
      roundOff: n(t.roundOff)!,
      tenders: [...refundLegTenders, ...pointsLeg],
      cogsAmount: n(cogs)!,
    });
    // D8 / D39 — a FINANCIAL credit note cuts no output GST: the tax share is
    // a customer claim allowed instead. Only behind the override (CA, O1).
    const legs = financial ? financialLegs(built) : built;
    // Review 11-14 B1 — a 0.00 note (a scheme's free line, D6; a no-bill line
    // with no price, overridden) moves stock and COGS only: no register row,
    // no balance row, no settlement. Under PERIODIC (or a line with no cost)
    // not even a COGS pair is left, and it posts with no voucher at all.
    const zeroNote = returnAmt.isZero();
    const voucher = !legs.some((l) => Math.round(Math.abs(l.amount) * 100) !== 0)
      ? null
      : await this.legs.postLegs(tx, {
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
            docAmount: n(returnAmt)!,
            roundOff: n(t.roundOff)!,
            partyId,
            userId: isUuid(row.srUserId as string) ? (row.srUserId as string) : actor,
            sessionId: row.srSessionId as string | null,
            deviceType: row.srDeviceType as string | null,
            remarks: row.srReturnReason as string | null,
            deviceCode: null,
            createdBy: actor,
            // The refno is the return's own (per device, D16). Its serial is NOT
            // handed over as presetNo: ux_avh_voucher_no has no device in it, so
            // the voucher takes the company serial (erp-per-device-numbers).
            presetRefno: row.srReturnRefno as string,
          },
          legs,
        });

    // 3 · the register — a CREDIT NOTE, sign −1 (gap 50 rule). A financial
    //     credit note declares nothing (D8): no register row, no IRN. Nor
    //     does a 0.00 note (B1): there is no credit to declare.
    const reg =
      financial || zeroNote || !voucher
        ? { gdrId: null, einvoiceApplicable: false, ewaybillApplicable: false }
        : await this.register.write(
            tx,
            returnRegisterDoc(row, money, voucher.voucherId, voucher.voucherLastNo, actor),
            {
              companyEinvoiceFlag: company.einvoice,
              interState: nature === 'INTER',
            },
          );

    // 4 · the credit the customer holds, and how it is settled (D35). Decimal
    //     to the paisa: ck_sr_settle_sum wants refund + adjusted + credit +
    //     points back = return amount EXACTLY. A 0.00 note holds nothing
    //     (ck_abl_amount wants a balance row above 0): no row, no settlement.
    const refunded = zeroNote ? ZERO : (plan.refund?.refunded ?? ZERO);
    const pointsBackAmt = zeroNote ? ZERO : plan.shares.pointsBackAmt;
    const cnAbl =
      zeroNote || !voucher
        ? null
        : await tx.accBillBalance.create({
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
              ablVoucherNo: voucher.voucherLastNo,
              ablVoucherDate: row.srReturnDate as Date,
              ablVoucherRefno: refno,
              ablDocRefno: refno,
              ablDocDate: row.srReturnDate as Date,
              ablDrCr: 'CR',
              ablBillAmount: returnAmt,
              // What the note paid out at once: the refund, and the points share.
              ablAllocAmount: refunded.plus(pointsBackAmt),
              ablNarration: row.srReturnReason as string | null,
              // Grid 210 and creditApplied() tell "Adjust at Post" as a voucher-less
              // NOTE_ADJUST against a DR bill created BEFORE this note, so this
              // moment must not move after the post.
              ablCreatedOn: now,
              ablCreatedBy: actor,
            },
            select: { ablId: true },
          });
    // Adjust at Post (D1 / D2), in THIS transaction: a voucher-less NOTE_ADJUST
    // per bill (the "own Adjust at Post" rule grid 210 and creditApplied() read).
    let adjusted = ZERO;
    const noteAblId = cnAbl?.ablId ?? null;
    for (const line of noteAblId ? (plan.adjust?.lines ?? []) : []) {
      if (line.amount.lte(0)) {
        continue;
      }
      adjusted = adjusted.plus(
        await this.adjustBill(tx, row, line.bill, noteAblId!, line.amount, actor, now),
      );
    }
    const credited = returnAmt.minus(refunded).minus(adjusted).minus(pointsBackAmt);
    const settleStatus = settleStatusOf({ refunded, adjusted, pointsBackAmt, credited });

    // 5 · loyalty: the earned points taken back (D9), the points share given
    //     back (D48); the promotion benefit taken back is reported.
    let loyaltyReversed = 0;
    let promoClawback = ZERO;
    let pointsBack = ZERO;
    if (money.bill) {
      const bill = money.bill;
      promoClawback = t.schDisc.plus(t.billSchDisc);
      const retDoc = {
        docId: keys.id,
        accYear: keys.accYear,
        companyId: keys.companyId,
        branchId: keys.branchId,
        docDate,
        docRefno: refno,
        memberId: bill.loyaltyMemberId ?? '',
      };
      // N3 — exactly the figure the preview showed (plan.loyaltyReverse: the
      // line-taxable share, the emptying return the rest), handed over whole
      // (share 1); the wallet still caps it.
      if (bill.loyaltyMemberId && plan.loyaltyReverse.gt(0)) {
        const cb = await this.loyalty.clawbackForReturn(tx, retDoc, 1, {
          earnedOnBill: n(plan.loyaltyReverse)!,
          createdBy: actor,
        });
        loyaltyReversed = cb.clawedBack;
      }
      if (bill.loyaltyMemberId && plan.shares.points.gt(0)) {
        const r = await this.loyalty.restoreRedeemForReturn(
          tx,
          retDoc,
          { billId: bill.sbId, billAccYear: bill.accYear, refno: bill.refno },
          n(plan.shares.points)!,
          { approvedBy: actor, createdBy: actor },
        );
        pointsBack = D(r.pointsRestored);
      }
    }

    // 6 · the header, status last — with the figures the legs carry.
    await this.store.setStatus(
      tx,
      row,
      'POSTED',
      {
        ...headerFieldsOf(money),
        srPostedVoucherId: voucher?.voucherId ?? null,
        srTotalCost: cogsTotal,
        srRefundAmt: refunded,
        srAdjustedAmt: adjusted,
        srCreditAmt: credited,
        srPointsBack: pointsBack,
        srPointsBackAmt: pointsBackAmt,
        srVoucherShareAmt: plan.shares.voucherShare,
        srAgentCommAmt: plan.agentCommBack.gt(0) ? plan.agentCommBack : null,
        srGstMode: financial ? 'FINANCIAL' : 'GST',
        srSettleStatus: settleStatus,
        srLoyaltyReversePoints: new Prisma.Decimal(loyaltyReversed),
        srPromoClawbackAmt: promoClawback,
        ...(revisionNo ? { srRevisionNo: revisionNo } : {}),
      },
      actor,
      now,
    );
    // 7 · the bill's return fields (D62 / D76), from every posted return.
    if (money.bill) {
      await this.refreshBillReturnFields(tx, money.bill, ctx.actorName, now);
    }
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
        srPostedVoucherId: voucher?.voucherId ?? null,
        gdrId: reg.gdrId,
        refunded: n(refunded),
        adjusted: n(adjusted),
        credited: n(credited),
        pointsBackAmt: n(pointsBackAmt),
      },
      actor,
      voucher
        ? `Sale return posted (voucher ${voucher.voucherRefno})`
        : 'Sale return posted at 0.00 (stock only, no voucher)',
    );
    return reg.gdrId
      ? { gdrId: reg.gdrId, einvoice: reg.einvoiceApplicable, ewaybill: reg.ewaybillApplicable }
      : null;
  }

  /**
   * One Adjust-at-Post row (D1): the bill keeps the set-offs it already
   * carries and gains this note's. Returns what was set off (never more than
   * the bill still owes, read under its lock).
   */
  private async adjustBill(
    tx: Prisma.TransactionClient,
    row: DocRow,
    target: { ablId: string; ablAccYear: string },
    noteAblId: string,
    amount: Prisma.Decimal,
    actor: string,
    now: Date,
  ): Promise<Prisma.Decimal> {
    const [billAbl] = await tx.$queryRaw<
      {
        abl_id: string;
        abl_acc_year: string;
        abl_pending_amount: Prisma.Decimal | null;
        abl_bill_amount: Prisma.Decimal;
        abl_alloc_amount: Prisma.Decimal;
        abl_branch_id: string;
      }[]
    >`
      SELECT abl_id, abl_acc_year, abl_pending_amount, abl_bill_amount, abl_alloc_amount, abl_branch_id
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${target.ablId}::uuid AND abl_acc_year = ${target.ablAccYear}::char(9)
         AND abl_is_deleted = false AND abl_is_active = true FOR UPDATE`;
    if (!billAbl) {
      return ZERO;
    }
    const take = Prisma.Decimal.min(
      amount,
      Prisma.Decimal.max(ZERO, D(billAbl.abl_pending_amount ?? 0)),
    );
    if (take.lte(0)) {
      return ZERO;
    }
    const accYear = billAbl.abl_acc_year.trim();
    // ONE pair: the set-offs the bill already carries (its own, other notes',
    // advances) stay exactly as they are — S2: re-posting them re-stamped
    // another note's Adjust at Post as if somebody had used that note.
    await addBillAdjustment(
      tx,
      this.adjustCtx(row, billAbl, accYear, actor),
      {
        againstBillId: noteAblId,
        againstBillAccYear: row.srAccYear as string,
        amount: take,
        remarks: `Adjusted at post of return ${(row.srReturnRefno as string | null) ?? ''}`,
      },
      actor,
      now,
    );
    return take;
  }

  /** The bill-wise context the per-pair writers take, for one bill this return sets off. */
  private adjustCtx(
    row: DocRow,
    billAbl: {
      abl_id: string;
      abl_bill_amount: Prisma.Decimal;
      abl_alloc_amount: Prisma.Decimal;
      abl_branch_id: string;
    },
    accYear: string,
    actor: string,
  ): BillAdjustmentContext {
    return {
      billId: billAbl.abl_id,
      billAccYear: accYear,
      billAmount: billAbl.abl_bill_amount,
      // Unused by the per-pair writers (they move the allocation by the pair's
      // amount); carried because the context type has it.
      paidAmount: billAbl.abl_alloc_amount,
      companyId: row.srCompanyId as string,
      branchId: billAbl.abl_branch_id,
      tenantId: row.srTenantId as string | null,
      accYear,
      partyId: row.srCustId as string,
      adjDate: row.srReturnDate as Date,
      userId: isUuid(row.srUserId as string) ? (row.srUserId as string) : actor,
      sessionId: row.srSessionId as string | null,
    };
  }

  /**
   * D62 / D76 — the bill's return fields, from every POSTED return of it:
   * each line's returned qty in its own unit, the returned amount, FULL /
   * PARTIAL, and on each charge row what returns gave back (D36).
   */
  private async refreshBillReturnFields(
    tx: Prisma.TransactionClient,
    bill: { sbId: string; accYear: string },
    actorName: string,
    now: Date,
  ): Promise<void> {
    const [lines, prior, charges] = await Promise.all([
      this.reader.billLines(tx, bill),
      this.reader.priorBack(tx, bill, null),
      this.reader.billCharges(tx, bill, null),
    ]);
    let anyBack = false;
    let allBack = lines.length > 0;
    for (const l of lines) {
      const base = prior.get(l.billItemId)?.base ?? ZERO;
      const billBase = l.qty.times(l.factor);
      anyBack = anyBack || base.gt(0);
      allBack = allBack && base.gte(billBase);
      const qty = l.factor.gt(0)
        ? base.dividedBy(l.factor).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)
        : base;
      await tx.$executeRaw`
        UPDATE sales.sale_bill_item SET sbi_return_qty = ${qty}::numeric
         WHERE sbi_id = ${l.billItemId}::uuid AND sbi_acc_year = ${l.accYear}::char(9)
           AND sbi_return_qty IS DISTINCT FROM ${qty}::numeric`;
    }
    for (const c of charges) {
      await tx.$executeRaw`
        UPDATE public.txn_charge_detail SET cd_carried_amt = ${c.backBefore.amount}::numeric, cd_modified_on = now()
         WHERE cd_id = ${c.cdId}::uuid AND cd_acc_year = ${c.accYear}::char(9)
           AND COALESCE(cd_carried_amt, 0) <> ${c.backBefore.amount}::numeric`;
    }
    const [sum] = await tx.$queryRaw<{ amt: Prisma.Decimal | null }[]>`
      SELECT SUM(sr_return_amt) AS amt FROM sales.sale_return
       WHERE sr_bill_id = ${bill.sbId}::uuid AND sr_bill_acc_year = ${bill.accYear}::char(9)
         AND sr_status = 'POSTED' AND sr_is_deleted = false`;
    const returnedAmt = D(sum?.amt ?? 0);
    const status = allBack ? 'FULL' : anyBack || returnedAmt.gt(0) ? 'PARTIAL' : null;
    await tx.$executeRaw`
      UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric, sb_return_status = ${status},
             sb_modified_on = ${now}, sb_modified_by = ${actorName}
       WHERE sb_id = ${bill.sbId}::uuid AND sb_acc_year = ${bill.accYear}::char(9)`;
  }

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
      // S6 — the bill's lines and charge rows, locked as /post locks them (id
      // order) before anything of the bill is read: the refresh below rewrites
      // sbi_return_qty / sb_returned_amt from what every posted return took.
      await this.lockBillOf(tx, row);
      // The session check first: assertUnwindable may cancel the IRN / e-way bill on its way through.
      await this.assertRefundSessionOpen(tx, row);
      await this.assertUnwindable(tx, row, dto.reason, 'cancel');
      const reversal = await this.unwind(tx, row, ctx.actor, ctx.actorName, dto.reason, now);
      await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
      await this.refreshBillOf(tx, row, ctx.actorName, now);
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
      // S6 — the bill's lines and charge rows, in /post's order, before
      // anything of the bill is read or its return fields are rewritten.
      await this.lockBillOf(tx, row);
      const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
      // Lock 2: a declared credit note is cancelled and raised again, never amended.
      await assertAmendable(tx, gdrId);
      // The cancel rule (gap 33 / D32): a refund paid out of a REAL till
      // session that no longer takes money has been counted — it is taken
      // back with a Receipt, not by re-posting the return. Asked before
      // anything is unwound.
      await this.assertRefundSessionOpen(tx, row);
      await this.assertUnwindable(tx, row, dto.editRemark, 'amend');
      // Notes 89 — the return as /get answered it before the amend.
      const before = await this.documentOf(tx, keys);
      await this.unwind(
        tx,
        row,
        ctx.actor,
        ctx.actorName,
        `Amended: ${dto.editRemark}`,
        now,
        'amend',
      );
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
          srPointsBackAmt: 0,
        },
        ctx.actor,
        now,
      );
      await this.refreshBillOf(tx, draft, ctx.actorName, now);
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
      // S4 — D77's freeze is a DRAFT's: a POSTED return amended while its
      // post-hoc review waits withdraws that review (it describes the
      // revision being replaced); the re-post's own gate files a fresh one
      // if the rule still asks.
      const revisionNo = (row.srRevisionNo as number) + 1;
      if ((await this.reader.approvalsOf(tx, keys.id)).some((a) => a.status === 'PENDING')) {
        await this.approvals.withdrawForDocument(tx, {
          companyId: keys.companyId,
          srcDocType: 'SALE_RETURN',
          srcDocId: keys.id,
          userId: ctx.actor,
          deviceId: isUuid(row.srDeviceId as string | null) ? (row.srDeviceId as string) : null,
          note: `Withdrawn by ${ctx.actorName}: the return was amended to revision ${revisionNo}`,
        });
      }
      const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
      void _b;
      void _e;
      void _o;
      // Re-saved with the money worked out again (D45), then re-posted on the
      // same locks and checks as /post.
      const ms = await this.moneySettings(
        keys.companyId,
        keys.branchId,
        row.srDeviceId as string | null,
        ctx.settings,
      );
      const saved = await this.saveBody(
        tx,
        { ...(saveDto as unknown as SaveSaleReturnDto), srId: keys.id },
        ctx.actor,
        now,
        ms,
        { amend: true },
      );
      // S1 — an amend from Refund to Adjust / Credit note leaves no refund rows live.
      await this.dropRefundRowsUnlessCash(tx, saved);
      // The re-post moves money like /post: the amending device's live
      // session, and the (possibly changed) cash refund judged against it.
      await this.tillForPost(tx, saved, ctx);
      fire = await this.postPipeline(tx, saved, ctx, {
        overrides: dto.overrides ?? [],
        adjustments: dto.adjustments,
        approvalIds: dto.approvalIds ?? {},
        now,
        revisionNo,
        title: 'Sale return cannot be amended',
        expectReturnAmt: dto.srReturnAmt,
      });
      // ONE revision after the amend's own writes: the re-posted return.
      await this.writeRevision(
        tx,
        keys,
        before,
        ctx.actor,
        `Sale return amended to revision ${revisionNo}: ${dto.editRemark}`,
      );
    }, TX);
    if (fire) {
      this.gst.enqueueAfterPost(fire);
    }
    return this.get({
      id: dto.srId,
      companyId: dto.srCompanyId,
      branchId: dto.srBranchId,
      accYear: dto.srAccYear,
    });
  }

  /**
   * How many live uses of this credit note OTHER documents made — the
   * CN_APPLIED lock. A live row on the note that is not reversed (nor a
   * reversal) and is not the note's own Adjust at Post (OWN_ADJUST_AT_POST):
   * a bill's F4 set-off, a receipt that spent it, anything else.
   */
  private async creditApplied(c: Prisma.TransactionClient, row: DocRow): Promise<number> {
    const [r] = await c.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        LEFT JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId as string}::uuid AND b.abl_acc_year = ${row.srAccYear as string}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         AND NOT (j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL AND k.abl_dr_cr = 'DR'
                  AND k.abl_created_on < b.abl_created_on)`;
    return Number(r?.n ?? 0);
  }

  /**
   * Gap 33 / D32 / D38 — a return that paid money out of a REAL till session
   * cannot be cancelled once that session stops taking money (anything but
   * OPEN / SUSPENDED): the refund has been counted. A counter with no till
   * (no session, or an id that names none) is not governed: allowed, as before.
   */
  private async assertRefundSessionOpen(tx: Prisma.TransactionClient, row: DocRow): Promise<void> {
    if (D(row.srRefundAmt as Prisma.Decimal.Value).lte(0)) {
      return;
    }
    const session = await this.reader.sessionOf(tx, row.srSessionId as string | null);
    if (!session || ['OPEN', 'SUSPENDED'].includes(session.status)) {
      return;
    }
    throwSalesLocked(
      `This return refunded ${String(row.srRefundAmt)} out of till session ${session.sessionNo ?? ''}, which is ` +
        `${session.status}: take the money back with a Receipt instead`,
      SALES_ERROR_CODES.RETURN_REFUND_SESSION_CLOSED,
      'srId',
      { status: session.status },
    );
  }

  /**
   * Review 11-14 point 5 (N9's rule, the other way round) — the unwind takes
   * the note's own Adjust at Post back off each bill it set off, writing the
   * reversal rows in the BILL's year (reverseBillAdjustmentsWith). A bill of a
   * year the company may not write to (closedYears: not OPEN, or past its
   * lock date — assertAccYearWritable's rule) refuses the cancel / amend with
   * SALES_YEAR_LOCKED, asked before anything is written (the IRN / e-way bill
   * cancel included).
   */
  private async assertAdjustedBillsWritable(
    tx: Prisma.TransactionClient,
    row: DocRow,
    noteAblId: string | null,
    verb: 'cancel' | 'amend',
  ): Promise<void> {
    if (!noteAblId) {
      return;
    }
    const targets = await this.adjustedAtPost(tx, noteAblId, row.srAccYear as string);
    if (targets.length === 0) {
      return;
    }
    const shut = await this.reader.closedYears(
      tx,
      row.srCompanyId as string,
      targets.map((t) => t.ablAccYear),
    );
    const blocked = targets.find((t) => shut.has(t.ablAccYear));
    if (blocked) {
      throwSalesLocked(
        `This return set off bill ${blocked.refno ?? blocked.ablId} of ${blocked.ablAccYear}, a closed year: ` +
          `that set-off cannot be taken back, so the return cannot be ${verb === 'cancel' ? 'cancelled' : 'amended'} now`,
        SALES_ERROR_CODES.YEAR_LOCKED,
        'adjustedBills',
        { params: { bill: blocked.refno ?? '', year: blocked.ablAccYear } },
      );
    }
  }

  /** S6 — lock the return's bill lines and charge rows as /post does (lockAndWorkOut). */
  private async lockBillOf(tx: Prisma.TransactionClient, row: DocRow): Promise<void> {
    if (row.srBillId && row.srBillAccYear) {
      const bill = { sbId: row.srBillId as string, accYear: (row.srBillAccYear as string).trim() };
      await this.reader.lockBillLines(tx, bill);
      await this.reader.lockBillCharges(tx, bill);
    }
  }

  private async refreshBillOf(
    tx: Prisma.TransactionClient,
    row: DocRow,
    actorName: string,
    now: Date,
  ): Promise<void> {
    if (row.srBillId && row.srBillAccYear) {
      await this.refreshBillReturnFields(
        tx,
        { sbId: row.srBillId as string, accYear: (row.srBillAccYear as string).trim() },
        actorName,
        now,
      );
    }
  }

  /**
   * The bills the return set itself off against at post (D1), still live.
   *
   * OWN_ADJUST_AT_POST — which live set-offs on the note are its own. A note
   * can be set off at its post only against a receivable that already
   * existed; every later use of it is by a document raised after it (a bill
   * F4 at its /post or amend, which writes a NEW receivable) or by a receipt
   * (its rows carry the receipt's voucher). So: a voucher-less NOTE_ADJUST
   * against a DR receivable created BEFORE the note. Read off the documents,
   * never off the adjustment rows' own moment — a later re-post of a bill's
   * set-offs re-stamps those (S2).
   */
  private async adjustedAtPost(
    tx: Prisma.TransactionClient,
    noteAblId: string,
    noteAccYear: string,
  ): Promise<{ ablId: string; ablAccYear: string; refno: string | null }[]> {
    return (
      await tx.$queryRaw<{ abl_id: string; abl_acc_year: string; abl_doc_refno: string | null }[]>`
        SELECT DISTINCT k.abl_id, k.abl_acc_year, k.abl_doc_refno
          FROM accounts.acc_bill_adjustment j
          JOIN accounts.acc_bill_balance n ON n.abl_id = j.abj_bill_id AND n.abl_acc_year = j.abj_bill_acc_year
          JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
         WHERE j.abj_bill_id = ${noteAblId}::uuid AND j.abj_bill_acc_year = ${noteAccYear}::char(9)
           AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
           AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
           AND k.abl_dr_cr = 'DR' AND k.abl_created_on < n.abl_created_on`
    ).map((r) => ({
      ablId: r.abl_id,
      ablAccYear: r.abl_acc_year.trim(),
      refno: r.abl_doc_refno ?? null,
    }));
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
         AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         -- OWN_ADJUST_AT_POST (adjustedAtPost): what the return itself set off.
         AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
         AND k.abl_dr_cr = 'DR' AND k.abl_created_on < b.abl_created_on`;
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
    // S7 — the note's balance row is locked first: a Sale Bill's F4 use
    // committing between this check and the unwind's delete would give the
    // customer the credit twice. One that already holds it is waited for, and
    // its set-off is then seen below.
    const [note] = await tx.$queryRaw<{ abl_id: string }[]>`
      SELECT abl_id FROM accounts.acc_bill_balance
       WHERE abl_src_doc_type = 'SALE_RETURN' AND abl_src_doc_id = ${row.srId as string}::uuid
         AND abl_acc_year = ${row.srAccYear as string}::char(9) AND abl_is_deleted = false
       FOR UPDATE`;
    if ((await this.creditApplied(tx, row)) > 0) {
      throwSalesLocked(
        'This credit note has been set off against a bill or refunded — money has moved; reverse it with a document, not by un-doing this one',
        SALES_ERROR_CODES.CN_APPLIED,
        'srId',
      );
    }
    await this.assertAdjustedBillsWritable(tx, row, note?.abl_id ?? null, verb);
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
    verb: 'cancel' | 'amend' = 'cancel',
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
      // An amend RETIRES the row so the re-post can file the same credit note
      // again (uq_acc_voucher_doc_register_source / _doc_out hold a CANCELED
      // row's number — DocRegisterService.retire); a cancel marks it CANCELED.
      if (verb === 'amend') {
        await this.register.retire(tx, gdrId, keys.accYear, actor);
      } else {
        await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
      }
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
    if (cn && row.srCustId) {
      for (const target of await this.adjustedAtPost(tx, cn.ablId, keys.accYear)) {
        const [billAbl] = await tx.$queryRaw<
          {
            abl_id: string;
            abl_acc_year: string;
            abl_bill_amount: Prisma.Decimal;
            abl_alloc_amount: Prisma.Decimal;
            abl_branch_id: string;
          }[]
        >`
          SELECT abl_id, abl_acc_year, abl_bill_amount, abl_alloc_amount, abl_branch_id FROM accounts.acc_bill_balance
           WHERE abl_id = ${target.ablId}::uuid AND abl_acc_year = ${target.ablAccYear}::char(9) AND abl_is_deleted = false
             FOR UPDATE`;
        if (!billAbl) {
          continue;
        }
        const year = billAbl.abl_acc_year.trim();
        // Only this note's pairs come off; every other set-off on the bill
        // (another return's, the bill's own, an advance) is left untouched.
        await reverseBillAdjustmentsWith(
          tx,
          this.adjustCtx(row, billAbl, year, actor),
          { ablId: cn.ablId, ablAccYear: keys.accYear },
          `Sale return ${(row.srReturnRefno as string | null) ?? keys.id} ${verb === 'amend' ? 'amended' : 'cancelled'}`,
          actor,
          now,
        );
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
      await this.assertRight('edit', tx);
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

/** D22 — the agent's commission this return takes back, pro rata; the emptying return takes the rest. */
function agentCommOf(money: ReturnMoney): Prisma.Decimal | null {
  if (!money.bill || !money.priorHeader || money.bill.agentCommAmt.lte(0)) {
    return null;
  }
  return proRataBack({
    onBill: money.bill.agentCommAmt,
    prior: money.priorHeader.agentComm,
    part: money.lines.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO),
    whole: money.billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), ZERO),
    emptiesBill: money.emptiesBill,
  });
}

/**
 * A /get-shaped return as its revision keeps it: no lock state (derived, and
 * it moves with the clock) and no display-only names — the audit keeps the
 * ids (as the Sales Order's auditRecordOf drops its labels).
 */
function auditRecordOf(doc: Record<string, unknown>): Record<string, unknown> {
  const { locks: _locks, rights: _rights, ...record } = doc;
  void _locks;
  void _rights;
  const items = Array.isArray(record.items) ? (record.items as Record<string, unknown>[]) : [];
  return {
    ...record,
    items: items.map((i) => {
      const { sriItemName: _i, sriUnitName: _u, sriGodownName: _g, ...line } = i;
      void _i;
      void _u;
      void _g;
      return line;
    }),
  };
}

/**
 * D12 / D23 — the line's claim mark and its bucket, both server-owned. A
 * CLAIM line says where the goods are: BACK comes into the EXPIRED bucket (an
 * expired condition) or DAMAGED, marked for the supplier claim; DESTROYED is
 * classed the same way but brings no stock. A RETURN line carries no claim
 * mark and takes the bucket its condition says (lineBucketOf) — never a
 * client-sent bucket, never the column's default SALEABLE.
 */
function claimFieldsOf(item: DocRow, claim: boolean): DocRow {
  const sriBucket = lineBucketOf(item, claim);
  if (!claim) {
    return { sriClaimGoods: null, sriSupplierClaim: false, sriBucket };
  }
  const goods = ((item.sriClaimGoods as string | null) ?? '').toUpperCase() || null;
  if (goods === 'BACK') {
    return { sriClaimGoods: 'BACK', sriSupplierClaim: true, sriBucket };
  }
  return { sriClaimGoods: goods, sriSupplierClaim: false, sriBucket };
}

/** REFUNDED · ADJUSTED · CREDITED when the note went one way only, else PARTIAL. */
function settleStatusOf(f: {
  refunded: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  pointsBackAmt: Prisma.Decimal;
  credited: Prisma.Decimal;
}): string {
  const ways = [f.refunded, f.adjusted, f.pointsBackAmt, f.credited].filter((v) => v.gt(0)).length;
  if (ways <= 1) {
    if (f.refunded.gt(0)) {
      return 'REFUNDED';
    }
    if (f.adjusted.gt(0)) {
      return 'ADJUSTED';
    }
    return 'CREDITED';
  }
  return 'PARTIAL';
}

/**
 * D8 / D39 — a financial credit note: the output-GST legs it would have
 * reversed become one CLAIMS_ALLOWED leg on the same side, so the party and
 * the total stay as the GST note would have them and no GST is cut.
 */
function financialLegs(
  legs: ReturnType<typeof buildReturnLegs>,
): ReturnType<typeof buildReturnLegs> {
  const isTax = (l: { roleTag?: string | null }) => (l.roleTag ?? '').startsWith('OUTPUT_');
  const dr = legs.filter((l) => isTax(l) && l.drCr === 'DR').reduce((t, l) => t + l.amount, 0);
  const cr = legs.filter((l) => isTax(l) && l.drCr === 'CR').reduce((t, l) => t + l.amount, 0);
  const rest = legs.filter((l) => !isTax(l));
  const net = Math.round((dr - cr) * 100) / 100;
  if (net !== 0) {
    rest.push({
      role: 'CLAIMS_ALLOWED',
      roleTag: 'CLAIMS_ALLOWED',
      drCr: net > 0 ? 'DR' : 'CR',
      amount: Math.abs(net),
      field: 'taxes',
    });
  }
  return rest;
}

/** Popup 25's rows as the settlement reads them. */
function adjustAsksOf(
  rows:
    | readonly {
        ablId: string;
        ablAccYear: string;
        amount: string | number;
        dueNow?: string | number | null;
      }[]
    | undefined,
): AdjustAsk[] | null {
  if (rows === undefined) {
    return null;
  }
  return rows.map((r, index) => ({
    index,
    ablId: r.ablId,
    ablAccYear: r.ablAccYear,
    amount: D(r.amount),
    dueNow: r.dueNow === undefined || r.dueNow === null ? null : D(r.dueNow),
  }));
}

/** The stored refund rows as the settlement reads them. */
function refundTendersFromRows(
  rows: readonly {
    tdTenderId?: string | null;
    tdTenderTypeId?: unknown;
    tdAmount?: unknown;
    tdRefNo?: string | null;
  }[],
): RefundTender[] {
  return rows.map((r, index) => ({
    index,
    tenderId: r.tdTenderId ?? null,
    tenderTypeId: Number(r.tdTenderTypeId ?? 0),
    amount: D((r.tdAmount ?? 0) as Prisma.Decimal.Value),
    refNo: r.tdRefNo ?? null,
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
