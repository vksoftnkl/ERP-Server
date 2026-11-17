import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { withBatchDetails } from '../../stocks/batch-detail/batch-detail.helper';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TxnStatusDocType, TxnStatusEvent } from 'src/common/txn-status-log/txn-status-log.helper';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDrCr } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { BillReadService } from '../bill/bill-read.service';
import { SaleOrderService } from '../sale-order/sale-order.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { DC_SOURCE_KEYS, resolveSourceLines } from '../posting/source-lines';
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
  assertBandWritable,
  assertSalesmen,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
  heldAmong,
  heldOrdersDrawnMore,
  lockSourceOrders,
  type OrderDraw,
  refuse,
  refuseHeldOrders,
  warn,
} from '../posting/sales.guards';
import type { MenuRight } from '../../../common/posting/rights';
import {
  DC_ZERO_CHARGE_FIELDS,
  allocateDcDocNumber,
  assertNoCharges,
  checkDcFreeLines,
  checkDcMoney,
  dcAgeing,
  dcFreeTypeOf,
  dcOrderLineOf,
  dcQtyInOrderTerms,
  dcEwayStateOf,
  dcEwayVerdict,
  dcLineNames,
  dcPartBMissing,
  dcTotals,
  dec,
  lockDcLines,
  nextRegisterVoucherNo,
  applyDcLineLevels,
  orderLineFreeOf,
  orderLineKeysOf,
  orderLineRefsOf,
  registerDocTaxability,
  registerLineTaxability,
  type DcEwayFacts,
} from './dc-common';
import { throwSalesLocked, throwSalesRefusals, throwSalesRight } from '../posting/sales.errors';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type RightsBlock,
  type SalesGuardContext,
} from '../posting/types/posting.types';
import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
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
  // N2 (decision 30): a challan carries no charges; txn_charge_detail is never synced.
  chargeDocType: null,
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

/** What a post leaves for the GST queue once the transaction has committed. */
type DcPostFire = { gdrId: string | null; ewaybill: boolean };

/** Decision 34: the route's right on menu 182 (as sale-return.service RIGHT_CODES). */
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

/** P6 N1: each header GST figure and the line figure it is the sum of. */
const DC_HEADER_SPLIT = [
  ['sdcCgstAmt', 'sdiCgstAmt'],
  ['sdcSgstAmt', 'sdiSgstAmt'],
  ['sdcIgstAmt', 'sdiIgstAmt'],
  ['sdcCessAmt', 'sdiCessAmt'],
] as const;

/** The /validate dry run's stock pass is rolled back with this (nothing it wrote survives). */
class DryRunRollback extends Error {}

@Injectable()
export class DeliveryChallanService {
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
    private readonly billRead: BillReadService,
    private readonly audit: AuditLogService,
    charges: ChargeDetailService,
    tenders: TenderDetailService,
    private readonly saleOrders: SaleOrderService,
    private readonly reservations: StockReservationService,
  ) {
    this.store = new SalesDocStore(DC_SPEC, audit, charges, tenders, transportBand);
  }

  /**
   * User 2026-11-17 — the order lines' reservations, re-derived (a posted
   * challan consumes as a bill from the order does; a cancel gives back).
   */
  private async rederiveReservations(
    tx: Prisma.TransactionClient,
    items: readonly DocRow[],
    actor: string,
    now: Date,
  ): Promise<void> {
    const keys = await orderLineKeysOf(
      tx,
      items.map((i) => dcOrderLineOf(i)),
    );
    for (const [soId, lineNos] of keys) {
      await this.reservations.rederiveOrderLines(tx, soId, lineNos, actor, now);
    }
  }

  /**
   * User 2026-11-17 (Q6) — the orders a challan names, read WITHOUT a lock and
   * locked BEFORE the challan row, the bill's order (orders, then challan
   * rows). The caller locks the challan next and re-locks its orders from the
   * locked rows (lockDcOrders), which catches a change in between.
   */
  private async lockOrdersFirst(
    tx: Prisma.TransactionClient,
    /** The stored challan; null for one not saved yet (only `extra` is locked). */
    keys: DocKeys | null,
    extra: { header?: DocRow; lines?: DocRow[] } = {},
  ): Promise<void> {
    const [head] = keys
      ? await tx.$queryRaw<{ sdc_src_doc_type: string | null; sdc_src_doc_id: string | null }[]>`
          SELECT sdc_src_doc_type, sdc_src_doc_id FROM sales.sale_dc
           WHERE sdc_id = ${keys.id}::uuid AND sdc_acc_year = ${keys.accYear}::char(9)`
      : [];
    const lines = keys
      ? await tx.$queryRaw<
          { sdi_src_doc_type: string | null; sdi_src_doc_id: string | null; sdi_src_item_id: string | null }[]
        >`
          SELECT sdi_src_doc_type, sdi_src_doc_id, sdi_src_item_id FROM sales.sale_dc_item
           WHERE sdi_dc_id = ${keys.id}::uuid AND sdi_acc_year = ${keys.accYear}::char(9)
             AND sdi_is_deleted = false`
      : [];
    await lockDcOrders(
      tx,
      [
        { sdcSrcDocType: head?.sdc_src_doc_type ?? null, sdcSrcDocId: head?.sdc_src_doc_id ?? null },
        ...(extra.header ? [extra.header] : []),
      ],
      [
        ...(lines ?? []).map((l) => ({
          sdiSrcDocType: l.sdi_src_doc_type,
          sdiSrcDocId: l.sdi_src_doc_id,
          sdiSrcItemId: l.sdi_src_item_id,
        })),
        ...(extra.lines ?? []),
      ],
    );
  }

  /**
   * User 2026-11-17 — the challan draws its orders down: the order lines its
   * lines were taken from are re-derived (SaleOrderService.syncOrderFulfilment,
   * the one recompute bills use too) once the challan's status has moved. A
   * re-derive, never an increment; the orders are already locked by the caller.
   */
  private async syncOrders(
    tx: Prisma.TransactionClient,
    items: readonly DocRow[],
    actor: string,
    now: Date,
    reopenRemark?: string,
  ): Promise<void> {
    const refs = await orderLineRefsOf(
      tx,
      items.map((i) => dcOrderLineOf(i)),
    );
    if (refs.length > 0) {
      await this.saleOrders.syncOrderFulfilment(tx, { refs, reopenRemark }, actor, now);
    }
  }

  /** Decision 34 — the route's right on menu 182, or 403 SALES_RIGHT_<VERB>. */
  private async assertRight(
    right: MenuRight,
    client?: Prisma.TransactionClient,
  ): Promise<RightsBlock> {
    const rights = await this.salesContext.rights(DC_SPEC.menuId, client);
    if (!rights[right]) {
      throwSalesRight(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
    }
    return rights;
  }

  /**
   * The keys of a live challan with this id (any company), or null: CREATE vs
   * EDIT; `status` tells /validate an amend (POSTED) from a draft edit.
   */
  private async existingKeys(
    c: Prisma.TransactionClient,
    sdcId: string | undefined,
  ): Promise<(DocKeys & { status: string }) | null> {
    if (!sdcId) {
      return null;
    }
    const [r] = await c.$queryRaw<
      {
        sdc_id: string;
        sdc_company_id: string;
        sdc_branch_id: string;
        sdc_acc_year: string;
        sdc_status: string | null;
      }[]
    >`
      SELECT sdc_id, sdc_company_id, sdc_branch_id, sdc_acc_year, sdc_status FROM sales.sale_dc
       WHERE sdc_id = ${sdcId}::uuid AND sdc_is_deleted = false`;
    return r
      ? {
          id: r.sdc_id,
          companyId: r.sdc_company_id,
          branchId: r.sdc_branch_id,
          accYear: r.sdc_acc_year.trim(),
          status: r.sdc_status ?? 'DRAFT',
        }
      : null;
  }

  /**
   * Notes 89 (G9) — the ONE audit row of a save or an amend: the challan as
   * /get answers it AFTER the write, beside the `before` read first (null on a
   * create), on screen 99 'Delivery Challan' (log_rev_no counts the saves), as
   * SaleReturnService.writeRevision.
   */
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
        screenName: DC_SPEC.screenName,
        tableName: DC_SPEC.tableName,
        docId: keys.id,
        displayName: (after.sdcDcRefno as string | null) || keys.id,
        before: before === null ? null : dcAuditRecordOf(before),
        after: dcAuditRecordOf(after),
        userId: actor,
        branchId: keys.branchId,
        deviceId: (after.sdcDeviceId as string | null) ?? null,
        notes,
      },
      tx,
    );
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
    assertNoCharges(dto.charges);
    const actor = this.salesContext.actor();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await this.existingKeys(tx, dto.sdcId);
      await this.assertRight(existing ? 'edit' : 'create', tx);
      // P4 (user 11-17): every line's order link resolved to the order line's id.
      await resolveSourceLines(tx, dto.items as unknown as DocRow[], DC_SOURCE_KEYS, ['SALES_ORDER']);
      await this.freeFromOrders(tx, dto, true);
      applyDcLineLevels(dto);
      const before = existing ? await this.documentOf(tx, existing) : null;
      const saved = await this.store.saveDraft(
        tx,
        this.draftRow(dto),
        actor,
        now,
        this.draftHooks(tx, dto, now),
      );
      await this.writeRevision(
        tx,
        this.store.keysOf(saved),
        before,
        actor,
        before ? 'Challan updated' : 'Challan created',
      );
      return saved;
    }, TX);
    return this.get(this.store.keysOf(row));
  }

  /**
   * Notes 94 B / 106 — `/create` with `post: true` (or `sdcStatus: 'POSTED'`):
   * the draft save, every guard and the whole of `/post` in ONE transaction.
   * A refusal rolls the save back with the post — no header, no lines, no
   * number consumed — and is exactly what `/post` answers, because it is the
   * same guard run. Judged on the Post right alone (94 A).
   */
  async saveAndPost(dto: SaveDeliveryChallanDto): Promise<Record<string, unknown>> {
    assertNoCharges(dto.charges);
    const actor = this.salesContext.actor();
    const now = new Date();
    let fire: DcPostFire | null = null;
    let keys: DocKeys | null = null;
    await this.prisma.$transaction(async (tx) => {
      const existing = await this.existingKeys(tx, dto.sdcId);
      await this.assertRight(existing ? 'edit' : 'create', tx);
      await resolveSourceLines(tx, dto.items as unknown as DocRow[], DC_SOURCE_KEYS, ['SALES_ORDER']);
      // P6 S1 (decision 36): the orders, stored and sent, before the challan row.
      await this.lockOrdersFirst(tx, existing, {
        header: dto as unknown as DocRow,
        lines: (dto.items ?? []) as unknown as DocRow[],
      });
      // The flag is judged by the post's guards below (a refusal rolls all back).
      await this.freeFromOrders(tx, dto, false);
      applyDcLineLevels(dto);
      const before = existing ? await this.documentOf(tx, existing) : null;
      const saved = await this.store.saveDraft(
        tx,
        this.draftRow(dto),
        actor,
        now,
        this.draftHooks(tx, dto, now),
      );
      keys = this.store.keysOf(saved);
      await this.writeRevision(
        tx,
        keys,
        before,
        actor,
        before ? 'Challan updated' : 'Challan created',
      );
      // Re-read under the row lock, exactly as /post does.
      const row = await this.store.lock(tx, keys);
      fire = await this.postDraftInTx(tx, row, dto.overrides ?? [], now);
    }, TX);
    this.afterPost(fire);
    return this.get(keys as unknown as DocKeys);
  }

  /**
   * The save body as the store takes it: the one-call fields are instructions,
   * not columns; a challan carries no charges (§5.5: the four charge figures are
   * written 0, `charges` never reaches the store).
   */
  private draftRow(dto: SaveDeliveryChallanDto): DocRow {
    const { post: _post, overrides: _overrides, charges: _charges, ...row } = dto;
    void _post;
    void _overrides;
    void _charges;
    const out: DocRow = { ...row };
    for (const k of DC_ZERO_CHARGE_FIELDS) {
      out[k] = 0;
    }
    // P6 N1 / R2 (user 11-17): the header's GST split is never the body's (the
    // print and the register read it): the keys are dropped here, and the save
    // writes the STORED lines' sums after its line write (headerSplitHook), the
    // post again (postCore). A header-only body, or a line sent by id without
    // its amounts, cannot put its own figures on the print.
    for (const [h] of DC_HEADER_SPLIT) {
      delete out[h];
    }
    return out;
  }

  /**
   * P6 R2 — the store's afterWrite: the header GST split set to the sums of the
   * lines as STORED (every live line, sent or kept), written only when it moved.
   */
  private headerSplitHook(tx: Prisma.TransactionClient, actor: string, now: Date) {
    return async (row: DocRow, items: DocRow[]): Promise<void> => {
      const split = dcHeaderSplitOf(items);
      if (DC_HEADER_SPLIT.every(([h]) => dec(row[h] as Prisma.Decimal).equals(dec(split[h])))) {
        return;
      }
      await this.store.setStatus(tx, row, (row.sdcStatus as string) ?? 'DRAFT', split, actor, now);
      Object.assign(row, split);
    };
  }

  /**
   * User 2026-11-17 — a challan line's Free flag comes only from its order
   * line (Ctrl+F4). Every save stores the order line's free type on the lines
   * it is sent (`sdiFreeType`: the order's when both are free, else null). A
   * draft save (`refuseNow`) also refuses a wrong flag at once (SALES_AMOUNT_
   * MISMATCH rule FREE_LINE, 422); the one-call post and the amend leave that
   * to their guards, which judge the stored lines. A line that does not send
   * `sdiIsFree` on an update keeps its stored flag and type.
   */
  private async freeFromOrders(
    tx: Prisma.TransactionClient,
    dto: SaveDeliveryChallanDto,
    refuseNow: boolean,
  ): Promise<void> {
    const items = dto.items ?? [];
    const sent = items
      .map((i, idx) => {
        const row: Record<string, unknown> = { ...i, sdiLineNo: i.sdiLineNo ?? idx + 1 };
        return { item: i, row };
      })
      .filter(({ row }) => typeof row.sdiIsFree === 'boolean' || !row.sdiId);
    if (sent.length === 0) {
      return;
    }
    const orderFree = await orderLineFreeOf(
      tx,
      sent.map(({ row }) => dcOrderLineOf(row)).filter((id): id is string => !!id),
    );
    if (refuseNow) {
      const g = createGuardContext({ overrides: [], canOverride: false, throwOnRefusal: false });
      checkDcFreeLines(
        g,
        sent.map(({ row }) => row),
        orderFree,
      );
      if (g.refusals.length > 0) {
        throwSalesRefusals('Challan cannot be saved', g.refusals);
      }
    }
    for (const { item, row } of sent) {
      item.sdiFreeType = dcFreeTypeOf(row, orderFree);
    }
  }

  private draftHooks(tx: Prisma.TransactionClient, dto: SaveDeliveryChallanDto, now: Date) {
    return {
      // P6 R2 — the header GST split from the stored lines.
      afterWrite: this.headerSplitHook(tx, this.salesContext.actor(), now),
      beforeWrite: (data: DocRow) => {
        if (data.sdcDcDatetime === undefined && !data.sdcId) {
          data.sdcDcDatetime = now;
        }
      },
      // §5.1 — the device's own series (DC2627D14-00001), at the first save.
      numberFor: (docDate: Date) =>
        allocateDcDocNumber(tx, {
          vchrTypeId: DC_SPEC.voucherTypeId,
          companyId: dto.sdcCompanyId,
          branchId: dto.sdcBranchId,
          accYear: dto.sdcAccYear,
          deviceId: dto.sdcDeviceId,
          documentDate: docDate,
          field: 'sdcDeviceId',
        }),
      // The caller files the save as ONE revision (writeRevision).
      revision: true,
    };
  }

  async get(keys: DocKeys): Promise<Record<string, unknown>> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    await this.assertRight('view', c);
    return this.documentOf(c, keys);
  }

  /** The challan as /get answers it, read through `c` (a save reads its own writes). */
  private async documentOf(c: Prisma.TransactionClient, keys: DocKeys): Promise<Record<string, unknown>> {
    const row = await this.store.findOrThrow(c, keys);
    return this.payload(c, row);
  }

  async delete(dto: DeliveryChallanKeysDto): Promise<{ sdcId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    await this.prisma.$transaction(async (tx) => {
      await this.assertRight('delete', tx);
      await this.store.deleteDraft(tx, this.keys(dto), actor, new Date());
    }, TX);
    return { sdcId: dto.sdcId, deleted: true };
  }

  async openForBill(q: {
    companyId: string;
    branchId: string;
    partyId: string;
    accYear?: string | null;
  }) {
    // §8.2 — the bill's picker: VIEW on the Sales Bill (12), not on 182.
    const rights = await this.salesContext.rights(SALES_MENU_ID.SALE_BILL);
    if (!rights.view) {
      throwSalesRight('This user may not view on this menu', SALES_ERROR_CODES.RIGHT_VIEW);
    }
    return this.billRead.openSources({ ...q, kind: 'DC' });
  }

  private async payload(
    c: Prisma.TransactionClient,
    row: DocRow,
  ): Promise<Record<string, unknown>> {
    const docDate = isoDate(row.sdcDcDate as Date) ?? isoToday();
    const [items, transport, rights, gdrId, eway] = await Promise.all([
      this.store.loadItems(c, row),
      this.store.loadTransport(c, row),
      this.salesContext.rights(DC_SPEC.menuId, c),
      this.register.registerIdOf(c, row.sdcId as string, row.sdcAccYear as string),
      this.ewayOf(c, row, docDate),
    ]);
    const disposal = dcDisposalOf(items);
    const ageing = await dcAgeing(this.salesContext, this.statutory, {
      companyId: row.sdcCompanyId as string,
      branchId: row.sdcBranchId as string,
      purpose: row.sdcPurpose as string | null,
      docDate,
      status: row.sdcStatus as string,
      today: isoToday(),
      // P6 N2: nothing left out = no age (grid 116 shows '' then too).
      open: disposal.open,
    });
    const nameOf = await dcLineNames(
      c,
      items.map((i) => ({
        itemId: i.sdiItemId,
        itemUnitId: i.sdiItemUnitId,
        godownId: i.sdiGodownId,
        lotId: i.sdiLotId,
      })),
    );
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
    // 2 and once any line is billed. Once goods came back (P6 Q1, user 11-17):
    // only a non-SUPPLY challan with something still out (it converts to
    // SUPPLY, so the rest can be billed).
    locks.editable.purpose =
      row.sdcStatus === 'POSTED' &&
      !locks.irnLive &&
      !locks.ewbLive &&
      !disposal.billed &&
      (!disposal.returned ||
        (disposal.open && ((row.sdcPurpose as string | null) ?? 'SUPPLY').toUpperCase() !== 'SUPPLY'));
    return {
      ...this.store.plain(row),
      // Textile addendum 2 E3.3 — each line's batch size / colour / model; G8 the names.
      items: await withBatchDetails(
        c,
        row.sdcCompanyId as string,
        'sdi',
        items.map((i) => ({
          ...this.store.plain(i),
          ...nameOf({
            itemId: i.sdiItemId,
            itemUnitId: i.sdiItemUnitId,
            godownId: i.sdiGodownId,
            lotId: i.sdiLotId,
          }),
        })),
      ),
      // N2 — always empty: a challan carries no charges.
      charges: [],
      transport,
      posting,
      locks,
      rights,
      // §5.6 — days since the challan date and AMBER / RED ('' = fine).
      ageDays: ageing.ageDays,
      ageLevel: ageing.ageLevel,
      // P3b — the e-way verdict on the stored challan and its stored band.
      eway: {
        ...eway,
        transportMissing:
          eway.needed &&
          dcPartBMissing(transport as unknown as Record<string, unknown> | null, row),
      },
    };
  }

  /** The e-way verdict of a stored challan (/get): its value, POS and date. */
  private async ewayOf(
    c: Prisma.TransactionClient,
    row: DocRow,
    docDate: string,
  ): Promise<Omit<DcEwayFacts, 'transportMissing'>> {
    const [company] = await c.$queryRaw<{ comp_state_code: string | null }[]>`
      SELECT comp_state_code FROM public.companys WHERE comp_id = ${row.sdcCompanyId as string}::uuid`;
    return dcEwayVerdict(c, this.statutory, {
      companyId: row.sdcCompanyId as string,
      companyStateCode: company?.comp_state_code,
      posStateCode: row.sdcPosStcd as string | null,
      value: row.sdcDcAmt as Prisma.Decimal,
      docDate,
    });
  }

  // ── §4 validate / post ───────────────────────────────────────────────────

  /**
   * §8.2 `/validate` — every guard of `/post` as a dry run (nothing is written):
   * the money check, the e-way transport warning, and the stock engine's own
   * negative-stock verdict (G11), run in a transaction that is rolled back.
   * Right: CREATE (a new challan) or EDIT (a draft). On a POSTED challan it is
   * the AMEND's preview (P6 B1, amendPreview): AMEND right, judged as /amend.
   */
  async validate(dto: ValidateDeliveryChallanDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.sdcCompanyId, branchId: dto.sdcBranchId, deviceId: dto.sdcDeviceId },
      DC_SPEC.menuId,
    );
    const existing = await this.existingKeys(
      this.prisma as unknown as Prisma.TransactionClient,
      dto.sdcId,
    );
    const amending = existing?.status === 'POSTED';
    const right: MenuRight = amending ? 'amend' : existing ? 'edit' : 'create';
    if (!ctx.rights[right]) {
      throwSalesRight(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
    }
    const g = createGuardContext({
      overrides: dto.overrides ?? [],
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
      dryRun: true,
    });
    if (Array.isArray(dto.charges) && dto.charges.length > 0) {
      refuse(
        g,
        SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED,
        'A challan carries no charges: put freight and other charges on the Sales Bill',
        { field: 'charges' },
      );
    }
    const row = this.draftRow(dto);
    const items: DocRow[] = (dto.items ?? []).map((i, idx) => ({
      ...(i as unknown as DocRow),
      sdiLineNo: (i.sdiLineNo as number | null) ?? idx + 1,
    }));
    // P4: the order links as the save will store them, so /validate = /post.
    await resolveSourceLines(
      this.prisma as unknown as Prisma.TransactionClient,
      items,
      DC_SOURCE_KEYS,
      ['SALES_ORDER'],
    );
    // The band as sent; a saved challan's own when the body has none; and
    // none at all for a challan not saved yet (the one-call post's /validate
    // must show the e-way WARN its guards will raise).
    const band =
      dto.transport !== undefined
        ? { band: (dto.transport as Record<string, unknown> | null) ?? null }
        : dto.sdcId
          ? {}
          : { band: null };
    let eway: DcEwayFacts;
    if (amending && existing) {
      eway = await this.amendPreview(existing, row, items, ctx, g, band);
    } else {
      ({ eway } = await this.prisma.$transaction(
        (tx) => this.guards(tx, row, items, ctx, g, undefined, band),
        TX,
      ));
      await this.stockDryRun(row, items, ctx, g);
    }
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const nameOf = await dcLineNames(
      c,
      items.map((i) => ({
        itemId: i.sdiItemId,
        itemUnitId: i.sdiItemUnitId,
        godownId: i.sdiGodownId,
        lotId: i.sdiLotId,
      })),
    );
    const totals = dcTotals(row, items, (l) =>
      dec(
        nameOf({
          itemId: l.sdiItemId,
          itemUnitId: l.sdiItemUnitId,
          godownId: l.sdiGodownId,
          lotId: l.sdiLotId,
        }).unitKg,
      ),
    );
    return {
      ok: g.refusals.length === 0,
      refusals: g.refusals,
      warnings: g.warnings,
      rights: ctx.rights,
      totals,
      load: await this.loadOf(c, dto.sdcVehicleId ?? null, dec(totals.weightKg)),
      // P3b — why the e-way bill is (not) needed: nature, states, value, the limit.
      eway,
    };
  }

  /** §8.2 `load`: the vehicle's capacity against the challan's kg; null without a vehicle. */
  private async loadOf(
    c: Prisma.TransactionClient,
    vehicleId: string | null,
    weightKg: Prisma.Decimal,
  ): Promise<{ capacityKg: string | null; weightKg: string; percent: string | null } | null> {
    if (!vehicleId) {
      return null;
    }
    const [v] = await c.$queryRaw<{ cap: Prisma.Decimal | null }[]>`
      SELECT veh_capacity_kg AS cap FROM public.vehicle_master
       WHERE veh_id = ${vehicleId}::uuid AND veh_is_deleted = false`;
    const cap = v?.cap === null || v?.cap === undefined ? null : dec(v.cap);
    return {
      capacityKg: cap === null ? null : cap.toFixed(3),
      weightKg: weightKg.toFixed(3),
      percent:
        cap !== null && cap.greaterThan(0)
          ? weightKg.dividedBy(cap).times(100).toDecimalPlaces(1).toFixed(1)
          : null,
    };
  }

  /**
   * P6 B1 (user 11-17) — `/validate` on a POSTED challan is the preview of
   * `/amend`, and says what `/amend` will say (it said a draft's verdict: the
   * order's pending already held this challan, so "0 pending; this challan
   * takes 3", and the stock was issued twice). In ONE transaction that is
   * always rolled back, exactly as /amend runs it:
   *  - its lock order: the orders (stored and sent), the challan, its lines;
   *  - what /amend refuses before it unwinds, listed here: amending switched
   *    off, a live e-way bill, its date's books closed, anything billed or
   *    returned against it;
   *  - the amend's own unwind: its DC_ISSUE cancelled, back to DRAFT, its orders
   *    re-derived (this challan's quantity is pending again);
   *  - the guards with its posted lines as the prior ones (a held order lets
   *    it deliver less, not more), then the stock engine's dry issue.
   * The caller has checked the AMEND right.
   */
  private async amendPreview(
    keys: DocKeys,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
    band: { band?: Record<string, unknown> | null },
  ): Promise<DcEwayFacts> {
    let eway: DcEwayFacts | null = null;
    const now = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lockOrdersFirst(tx, keys, { header: row, lines: items });
        const stored = await this.store.lock(tx, keys);
        await lockDcLines(tx, keys.id, keys.accYear);
        const prior = await this.store.loadItems(tx, stored);
        if (!ctx.settings.allowPostedAmend) {
          refuse(
            g,
            SALES_ERROR_CODES.AMEND_OFF,
            'Amending a posted document is switched off (sales.allow_posted_amend)',
            { field: 'sdcId' },
          );
        }
        const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
        if ((await loadDeclaredLocks(tx, gdrId)).ewbLive) {
          refuse(
            g,
            SALES_ERROR_CODES.EWB_LIVE,
            'This challan has a live e-way bill and cannot be amended — cancel it and raise a fresh one',
            { field: 'sdcId' },
          );
        }
        // The guards judge the date the body sends; /amend also unwinds on the
        // stored one.
        const storedDate = isoDate(stored.sdcDcDate as Date) ?? isoToday();
        const sentDate = isoDate(row.sdcDcDate as Date | string | null) ?? isoToday();
        if (
          storedDate !== sentDate &&
          (await loadDayClosed(tx, keys.companyId, keys.branchId, storedDate))
        ) {
          refuse(
            g,
            SALES_ERROR_CODES.DAY_CLOSED,
            `The books for ${storedDate} are closed at this branch`,
            { field: 'sdcDcDate' },
          );
        }
        const { billed, returned } = dcDisposalOf(prior);
        if (billed) {
          refuse(
            g,
            SALES_ERROR_CODES.DC_BILLED,
            'A bill has been raised against this challan — cancel the bill first',
            { field: 'sdcId' },
          );
        }
        if (returned) {
          refuse(
            g,
            SALES_ERROR_CODES.DC_RETURNED,
            'Goods have been returned against this challan — cancel the DC return first',
            { field: 'sdcId' },
          );
        }
        // The amend's own unwind (all of it rolled back below).
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
          ctx.actor,
          'Amend preview (/validate)',
          now,
        );
        await this.store.setStatus(tx, stored, 'DRAFT', { sdcPostedVoucherId: null }, ctx.actor, now);
        await this.syncOrders(tx, prior, ctx.actor, now);
        ({ eway } = await this.guards(tx, { ...row, sdcId: keys.id }, items, ctx, g, prior, band));
        // Fresh line ids: the posted lines' own already have ledger rows.
        await this.issueDryRun(tx, row, items, ctx, g, true);
        throw new DryRunRollback();
      }, TX);
    } catch (error) {
      if (!(error instanceof DryRunRollback)) {
        throw error;
      }
    }
    return eway as unknown as DcEwayFacts;
  }

  /**
   * G11 — what the stock engine would say at post, said at /validate: the
   * challan's lines are issued through the real engine (the same company /
   * godown / item negative-stock rules) inside a transaction that is always
   * rolled back. A refusal (SALES_STOCK_NEGATIVE or the engine's own coded
   * one) is listed; anything else is left for /post to report.
   */
  private async stockDryRun(
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.issueDryRun(tx, row, items, ctx, g, false);
        throw new DryRunRollback();
      }, TX);
    } catch (error) {
      if (!(error instanceof DryRunRollback)) {
        // The dry run is advice; /post runs the engine for real and reports it.
        return;
      }
    }
  }

  /**
   * The dry issue itself, in the caller's transaction (which the caller rolls
   * back): the moving lines through the engine under a throw-away document id.
   * `freshLineIds`: every line under a throw-away id (an amend's posted lines
   * already have ledger rows); else a saved line keeps its own.
   */
  private async issueDryRun(
    tx: Prisma.TransactionClient,
    row: DocRow,
    items: DocRow[],
    ctx: SalesCallContext,
    g: SalesGuardContext,
    freshLineIds: boolean,
  ): Promise<void> {
    const moving = items.filter(
      (i) =>
        !(i.sdiIsService as boolean) &&
        i.sdiItemId &&
        i.sdiItemUnitId &&
        i.sdiGodownId &&
        dec(i.sdiDcQty as Prisma.Decimal).plus(dec(i.sdiFreeQty as Prisma.Decimal)).greaterThan(0),
    );
    if (moving.length === 0) {
      return;
    }
    const docId = randomUUID();
    try {
      await this.stock.post(
        tx,
        {
          docType: 'DELIVERY_CHALLAN',
          docId,
          accYear: row.sdcAccYear as string,
          companyId: row.sdcCompanyId as string,
          branchId: row.sdcBranchId as string,
          tenantId: (row.sdcTenantId as string | null) ?? null,
          deviceId: (row.sdcDeviceId as string | null) ?? null,
          sessionId: (row.sdcSessionId as string | null) ?? null,
          docDate: isoDate(row.sdcDcDate as Date | string | null) ?? isoToday(),
          docDatetime: new Date(),
          refno: `VALIDATE-${docId.slice(0, 8)}`,
          revision: 1,
          partyId: (row.sdcCustId as string | null) ?? null,
          direction: 'OUT',
          txnType: 'DC_ISSUE',
          // An unsaved line has no id yet: the engine keys its rows by a uuid.
          lines: moving.map((i) =>
            this.stockLineOf(
              i,
              !freshLineIds && isUuid(i.sdiId as string) ? (i.sdiId as string) : randomUUID(),
            ),
          ),
        },
        ctx.actor,
        new Date(),
      );
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse() as {
          message?: string;
          errors?: { code?: string; message?: string }[];
        };
        const first = Array.isArray(body?.errors) ? body.errors[0] : undefined;
        refuse(
          g,
          first?.code ?? SALES_ERROR_CODES.STOCK_NEGATIVE,
          first?.message ?? body?.message ?? 'Stock would go negative',
          { field: 'items' },
        );
      }
    }
  }

  /** One challan line as the stock engine takes it. */
  private stockLineOf(i: DocRow, lineId: string) {
    return {
      lineId,
      lineNo: i.sdiLineNo as number,
      itemId: i.sdiItemId as string,
      itemUnitId: i.sdiItemUnitId as string,
      godownId: i.sdiGodownId as string,
      lotId: (i.sdiLotId as string | null) ?? null,
      bucket: (i.sdiBucket as string | null) ?? null,
      qty: num(i.sdiDcQty as Prisma.Decimal),
      freeQty: num(i.sdiFreeQty as Prisma.Decimal),
      weightQty:
        i.sdiWeightQty === null || i.sdiWeightQty === undefined
          ? null
          : num(i.sdiWeightQty as Prisma.Decimal),
      toBaseFactor: num(i.sdiToBaseFactor as Prisma.Decimal) || null,
      batchNo: (i.sdiBatchNo as string | null) ?? null,
      batchDate: isoDate((i.sdiBatchDate as Date | null) ?? null),
      expiryDate: isoDate((i.sdiExpiryDate as Date | null) ?? null),
      serialNo: (i.sdiSerialNo as string | null) ?? null,
      mrp:
        i.sdiMaxPrice === null || i.sdiMaxPrice === undefined
          ? null
          : num(i.sdiMaxPrice as Prisma.Decimal),
      rate: num(i.sdiRate as Prisma.Decimal),
      taxPerc: num(i.sdiTaxPerc as Prisma.Decimal),
    };
  }

  async post(dto: PostDeliveryChallanDto): Promise<Record<string, unknown>> {
    let fire: DcPostFire | null = null;
    await this.prisma.$transaction(async (tx) => {
      // P6 S1 (decision 36): its orders before the challan row, as everywhere.
      await this.lockOrdersFirst(tx, this.keys(dto));
      const row = await this.store.lock(tx, this.keys(dto));
      fire = await this.postDraftInTx(tx, row, dto.overrides ?? [], new Date());
    }, TX);
    this.afterPost(fire);
    return this.get(this.keys(dto));
  }

  /**
   * The one-way door itself, on a row the caller has locked: the status
   * gates, the right, the guards, then `postCore`. Null when already POSTED
   * (idempotent). Shared by `/post` and the one-call save-and-post.
   */
  private async postDraftInTx(
    tx: Prisma.TransactionClient,
    row: DocRow,
    overrides: string[],
    now: Date,
  ): Promise<DcPostFire | null> {
    if (row.sdcStatus === 'POSTED') {
      return null;
    }
    if (row.sdcStatus === 'CANCELLED') {
      throwSalesLocked('This challan is CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
    }
    const ctx = await this.ctxOf(tx, row);
    if (!ctx.rights.post) {
      throwSalesRight('This user may not post on this menu', SALES_ERROR_CODES.RIGHT_POST);
    }
    const items = await this.store.loadItems(tx, row);
    // P4: a line stored without its order line's id (a draft saved before the
    // resolver) is resolved and stored now, so the draw-down counts it.
    const { changed } = await resolveSourceLines(tx, items, DC_SOURCE_KEYS, ['SALES_ORDER']);
    for (const idx of changed) {
      const i = items[idx];
      await this.store.updateItem(tx, i, {
        sdiSrcItemId: i.sdiSrcItemId,
        sdiSrcDocId: i.sdiSrcDocId,
        sdiSrcLineNo: i.sdiSrcLineNo,
        sdiSrcDocAccYear: i.sdiSrcDocAccYear,
      });
    }
    const g = createGuardContext({
      overrides,
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
    });
    await this.guards(tx, row, items, ctx, g);
    if (g.refusals.length > 0) {
      throwSalesRefusals('Challan cannot be posted', g.refusals);
    }
    return this.postCore(tx, row, items, ctx, now, 'DRAFT');
  }

  /** After the commit: the e-way bill queue, never inside the transaction. */
  private afterPost(fire: DcPostFire | null): void {
    if (fire) {
      this.gst.enqueueAfterPost({ gdrId: fire.gdrId, einvoice: false, ewaybill: fire.ewaybill });
    }
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
    /** Amend: the lines as they were posted (the delivery hold allows less, not more). */
    priorItems?: DocRow[],
    /** /validate: the transport band as sent (a saved challan's is read). */
    opts: { band?: Record<string, unknown> | null } = {},
  ): Promise<{ eway: DcEwayFacts }> {
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
      refuse(g, SALES_ERROR_CODES.DC_CUSTOMER_REQUIRED, 'A challan must name a customer', {
        field: 'sdcCustId',
      });
    }
    if (items.length === 0) {
      refuse(g, SALES_ERROR_CODES.DC_NO_LINES, 'A challan with no lines cannot be posted', {
        field: 'items',
      });
    }
    // N2 — a draft saved before the rule may still hold charge rows.
    if (row.sdcId) {
      const [ch] = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM public.txn_charge_detail
         WHERE cd_doc_type = 'DELIVERY_CHALLAN' AND cd_doc_id = ${row.sdcId as string}::uuid
           AND cd_is_deleted = false`;
      if ((ch?.n ?? 0) > 0) {
        refuse(
          g,
          SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED,
          'This challan carries charges: remove them, they belong on the Sales Bill',
          { field: 'charges' },
        );
      }
    }
    const [company] = await tx.$queryRaw<
      { comp_dc_purposes: string[] | null; comp_state_code: string | null }[]
    >`
      SELECT comp_dc_purposes, comp_state_code FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    // G13 — the money adds up, to the paisa (Decimal), and each line carries the
    // GST pair of the supply nature the register will file (rule TAX_SPLIT).
    checkDcMoney(
      g,
      row,
      items,
      supplyNatureOf(company?.comp_state_code, row.sdcPosStcd as string | null),
    );
    // Purpose — from comp_dc_purposes.
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
    // An order on delivery hold is not delivered either (Sales Order
    // Management, Q3 / D18), with no override: named by the header, by a line's
    // order id or by a line's order-line id. Read under the order's row lock
    // (lockSourceOrders), taken here before any stock write. An AMEND of a
    // challan posted before the hold is refused only when it delivers MORE
    // from the held order than the challan did (user, 2026-11-11).
    const heldOrderIds = [
      ...new Set(
        [
          row.sdcSrcDocType === 'SALES_ORDER' ? (row.sdcSrcDocId as string | null) : null,
          ...items.map((i) =>
            i.sdiSrcDocType === 'SALES_ORDER' ? (i.sdiSrcDocId as string | null) : null,
          ),
        ].filter((id): id is string => !!id),
      ),
    ];
    const held = heldAmong(
      await lockSourceOrders(
        tx,
        heldOrderIds,
        items
          .filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && i.sdiSrcItemId)
          .map((i) => i.sdiSrcItemId as string),
      ),
    );
    refuseHeldOrders(
      g,
      priorItems
        ? await heldOrdersDrawnMore(tx, held, dcItemDraws(items), dcItemDraws(priorItems))
        : held,
    );
    // P4 (user 11-17): every entry point resolved the order links
    // (source-lines.ts), so a line that names an order and still has no order
    // line id names a line that is not there (or no line at all).
    for (const [idx, i] of items.entries()) {
      if (i.sdiSrcDocType === 'SALES_ORDER' && !dcOrderLineOf(i)) {
        const n = (i.sdiLineNo as number | null | undefined) ?? idx + 1;
        refuse(
          g,
          SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
          `Line ${n}: order ${String(i.sdiSrcDocRefno ?? i.sdiSrcDocId ?? '')} has no line ${String(i.sdiSrcLineNo ?? '')} to take`,
          { field: 'items', line: n },
        );
      }
    }
    // Lines against an order may not exceed what is pending.
    const orderLines = items.filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && dcOrderLineOf(i));
    if (orderLines.length > 0) {
      const rows = await tx.$queryRaw<
        {
          soi_id: string;
          soi_pending_qty: Prisma.Decimal | null;
          soi_item_unit_id: string | null;
          soi_to_base_factor: Prisma.Decimal | null;
        }[]
      >`
        SELECT soi_id, soi_pending_qty, soi_item_unit_id, soi_to_base_factor
          FROM sales.sale_order_item WHERE soi_id = ANY(${orderLines.map((l) => l.sdiSrcItemId as string)}::uuid[])`;
      // G6 — Decimal throughout, no epsilon. User 11-17: soi_pending_qty is the
      // TRUE pending — POSTED challans draw the order down and POSTED DC returns
      // re-open it — and THIS challan is not in it: it is a draft here (an amend
      // re-derives its orders once it is back to DRAFT). Each line is counted
      // in its order line's terms, as the draw-down counts it.
      const by = new Map(rows.map((r) => [r.soi_id, r]));
      const taken = new Map<string, Prisma.Decimal>();
      for (const l of orderLines) {
        const k = l.sdiSrcItemId as string;
        const o = by.get(k);
        const qty = o ? dcQtyInOrderTerms(l, o) : dec(l.sdiDcQty as Prisma.Decimal);
        taken.set(k, (taken.get(k) ?? dec(0)).plus(qty));
      }
      for (const [k, qty] of taken) {
        const o = by.get(k);
        const pending = o ? dec(o.soi_pending_qty) : undefined;
        if (pending === undefined) {
          refuse(g, SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line ${k} does not exist`, {
            field: 'items',
          });
        } else if (qty.greaterThan(pending)) {
          (ctx.settings.allowBillOverOrderQty ? warn : refuse)(
            g,
            SALES_ERROR_CODES.DC_LINE_OVER_ORDER,
            `Order line has ${pending.toString()} pending; this challan takes ${qty.toString()}`,
            { field: 'items' },
          );
        }
      }
    }
    // User 2026-11-17 — a line is free only when its order line is (Ctrl+F4),
    // and a free line carries no price (SALES_AMOUNT_MISMATCH rule FREE_LINE).
    checkDcFreeLines(
      g,
      items,
      await orderLineFreeOf(
        tx,
        items.map((i) => dcOrderLineOf(i)).filter((id): id is string => !!id),
      ),
    );
    // E-way bill applicability against the band. The verdict's facts go back
    // to /validate as `eway` (the screen's "needed · …" line, P3b).
    const verdict = await dcEwayVerdict(tx, this.statutory, {
      companyId,
      companyStateCode: company?.comp_state_code,
      posStateCode: row.sdcPosStcd as string | null,
      value: row.sdcDcAmt as Prisma.Decimal,
      docDate,
    });
    const inter = verdict.supplyNature === 'INTER_STATE';
    let transportMissing = false;
    if (verdict.needed && (row.sdcId || opts.band !== undefined)) {
      const band =
        opts.band !== undefined
          ? opts.band
          : ((await this.store.loadTransport(tx, row)) as unknown as Record<string, unknown> | null);
      // G12 — Part-B is met by a transporter / LR, or by a vehicle number on the road.
      if (dcPartBMissing(band, row)) {
        transportMissing = true;
        warn(
          g,
          SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING,
          `An e-way bill is required for this consignment (${num(row.sdcDcAmt as Prisma.Decimal)} ${inter ? 'inter' : 'intra'}-state) and there is neither a transporter / LR nor a vehicle number`,
          { field: 'transport' },
        );
      }
    }
    return { eway: { ...verdict, transportMissing } };
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
        dec(i.sdiDcQty as Prisma.Decimal).plus(dec(i.sdiFreeQty as Prisma.Decimal)).greaterThan(0),
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
        lines: moving.map((i) => this.stockLineOf(i, i.sdiId as string)),
      },
      actor,
      now,
    );
    for (const i of moving) {
      await this.store.updateItem(tx, i, {
        // The cost of ONE unit of the line's unit, as the issue ledger booked it
        // (2026-11-16: this held the line TOTAL, and the return booked goods
        // back at that total per unit). The return copies it (decision 35).
        sdiCostPrice: dcUnitCostOf(i, stock),
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
          // §5.1 — the refno is the challan's own (per device). Its serial is NOT
          // handed over as presetNo: ux_avh_voucher_no has no device in it, so the
          // voucher takes the company serial (erp-per-device-numbers).
          presetRefno: row.sdcDcRefno as string,
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
    void voucherLastNo;
    if (row.sdcCustId) {
      const registerNo = await nextRegisterVoucherNo(tx, {
        companyId: keys.companyId,
        branchId: keys.branchId,
        accYear: keys.accYear,
        voucherTypeId: SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
      });
      const reg = await this.register.write(
        tx,
        this.registerDoc(row, items, voucherId, registerNo, nature, actor),
        {
          interState: nature === 'INTER',
          // A blank POS is judged by the company's state, as the guard (user 11-16).
          ewayStateCode: dcEwayStateOf(company?.comp_state_code, row.sdcPosStcd as string | null)
            .stateCode,
        },
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
        // P6 R2 — the GST split of the lines posted (a draft saved before the
        // rule may still hold the body's own).
        ...dcHeaderSplitOf(items),
        ...(revisionNo ? { sdcRevisionNo: revisionNo } : {}),
      },
      actor,
      now,
    );
    await this.fulfilment.recompute(tx, [{ dcId: keys.id, accYear: keys.accYear }], actor, now);
    // User 11-17 — the posted challan draws its orders down and consumes their
    // reservations, as a bill from the order does.
    await this.syncOrders(tx, items, actor, now);
    await this.rederiveReservations(tx, items, actor, now);
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
    // P6 N1 (user 11-17): the header's GST split is the lines' sums, as the
    // return files it — never the body's header figures (checkDcMoney checks
    // only the header's taxable / tax / amount against the lines).
    const sumOf = (k: string) =>
      num(items.reduce<Prisma.Decimal>((a, i) => a.plus(dec(i[k] as Prisma.Decimal)), dec(0)));
    const lines: RegisterDetailLine[] = items.map((i) => {
      const n = (k: string) => num(i[k] as Prisma.Decimal);
      const tax = n('sdiCgstAmt') + n('sdiSgstAmt') + n('sdiIgstAmt') + n('sdiCessAmt');
      const gst = {
        totalTaxRate: n('sdiTaxPerc'),
        cgstRate: n('sdiCgstPerc'),
        sgstRate: n('sdiSgstPerc'),
        igstRate: n('sdiIgstPerc'),
        cessRate: n('sdiCessPerc'),
        cgstAmount: n('sdiCgstAmt'),
        sgstAmount: n('sdiSgstAmt'),
        igstAmount: n('sdiIgstAmt'),
        cessAmount: n('sdiCessAmt'),
      };
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
        ...gst,
        otherAmount: 0,
        totalValue: round2(n('sdiTaxableAmt') + tax),
        billValue: n('sdiNetAmt') || round2(n('sdiTaxableAmt') + tax),
        // P3 fix 11-17: a FREE line (rate 0, tax 0) still carries its GST rates,
        // so it is TAXABLE (the Sales Bill's rule); EXEMPT 500'd on
        // chk_acc_voucher_doc_detail_non_taxable_zero.
        taxability: registerLineTaxability(gst),
        supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      };
    });
    return {
      companyId: row.sdcCompanyId as string,
      branchId: row.sdcBranchId as string,
      accYear: row.sdcAccYear as string,
      // A PERIODIC challan has no voucher; the register still needs one to key
      // on, so the (non-null) column takes the challan's own id and number.
      voucherId: voucherId ?? (row.sdcId as string),
      voucherTypeId: SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
      // The register's own serial (nextRegisterVoucherNo): per-device slnos repeat
      // across PCs and uq_acc_voucher_doc_register_voucher is per branch.
      voucherNo: voucherNo ?? numericTail(row.sdcDcRefno as string, BigInt(0)),
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
      taxability: registerDocTaxability(lines),
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
      cgstValue: sumOf('sdiCgstAmt'),
      sgstValue: sumOf('sdiSgstAmt'),
      igstValue: sumOf('sdiIgstAmt'),
      cessValue: sumOf('sdiCessAmt'),
      stateCessValue: 0,
      tcsValue: 0,
      // N2 — a challan carries no charges.
      otherCharge: 0,
      roundOff: d('sdcRoundOff'),
      billValue: d('sdcDcAmt'),
      remarks: typeof row.sdcPurpose === 'string' ? row.sdcPurpose : null,
      createdBy: actor,
      lines,
    };
  }

  // ── §4 cancel / amend ────────────────────────────────────────────────────

  /** §8.2 — the reversal; answers the /get payload plus `reversalVoucherRefno`. */
  async cancel(dto: CancelDeliveryChallanDto): Promise<Record<string, unknown>> {
    const now = new Date();
    const out = await this.prisma.$transaction(async (tx) => {
      // Q6 (user 11-17): its orders first, then the challan — the bill's order.
      await this.lockOrdersFirst(tx, this.keys(dto));
      const row = await this.store.lock(tx, this.keys(dto));
      // P6 S1: then its lines, BEFORE their billed / returned caches are read:
      // a bill or a DC return of it holds them until it commits.
      await lockDcLines(tx, row.sdcId as string, row.sdcAccYear as string);
      if (row.sdcStatus === 'CANCELLED') {
        return {
          reversalVoucherRefno: null as string | null,
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
      // User 11-17 — its source orders, locked before the unwind's stock writes
      // (lock order: sale_order, then stock — as the amend and the bill).
      await lockDcOrders(tx, [row], items);
      const reversal = await this.unwind(tx, row, ctx.actor, dto.reason, now);
      await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
      await this.fulfilment.recompute(
        tx,
        [{ dcId: row.sdcId as string, accYear: row.sdcAccYear as string }],
        ctx.actor,
        now,
      );
      // ...and the cancelled challan gives its orders their quantity back,
      // and their reservations what it consumed.
      await this.syncOrders(
        tx,
        items,
        ctx.actor,
        now,
        `Reopened: challan ${(row.sdcDcRefno as string | null) ?? (row.sdcId as string)} cancelled`,
      );
      await this.rederiveReservations(tx, items, ctx.actor, now);
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
      return { reversalVoucherRefno: reversal, cancelledOn: now.toISOString() };
    }, TX);
    return { ...(await this.get(this.keys(dto))), ...out };
  }

  async amend(dto: AmendDeliveryChallanDto): Promise<Record<string, unknown>> {
    assertNoCharges(dto.charges);
    const now = new Date();
    let fire: { gdrId: string | null; ewaybill: boolean } | null = null;
    await this.prisma.$transaction(async (tx) => {
      const keys: DocKeys = {
        id: dto.sdcId,
        companyId: dto.sdcCompanyId,
        branchId: dto.sdcBranchId,
        accYear: dto.sdcAccYear,
      };
      // P4: the new lines' order links resolved to the order line's id first.
      await resolveSourceLines(tx, dto.items as unknown as DocRow[], DC_SOURCE_KEYS, ['SALES_ORDER']);
      // Q6 (user 11-17): its orders, old and new, first; then the challan.
      await this.lockOrdersFirst(tx, keys, {
        header: dto as unknown as DocRow,
        lines: (dto.items ?? []) as unknown as DocRow[],
      });
      const row = await this.store.lock(tx, keys);
      // P6 S1: then its lines, before the billed / returned check (assertUnwindable).
      await lockDcLines(tx, keys.id, keys.accYear);
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
      // Notes 89 — the challan as /get answered it before the amend (the revision's `before`).
      const before = await this.documentOf(tx, keys);
      // The source orders, old and new, locked BEFORE the unwind's stock
      // writes (lock order: sale_order, then stock — lockSourceOrders).
      await lockDcOrders(
        tx,
        [row, dto as unknown as DocRow],
        [...items, ...((dto.items ?? []) as unknown as DocRow[])],
      );
      await this.unwind(tx, row, ctx.actor, `Amended: ${dto.editRemark}`, now, 'amend');
      const draft = await this.store.setStatus(
        tx,
        row,
        'DRAFT',
        { sdcPostedVoucherId: null },
        ctx.actor,
        now,
      );
      // User 11-17 — back to DRAFT, the challan no longer draws its orders: they
      // are re-derived now, so the guards below judge the new lines against the
      // true pending with this challan's own prior quantity added back.
      await this.syncOrders(
        tx,
        items,
        ctx.actor,
        now,
        `Reopened: challan ${(row.sdcDcRefno as string | null) ?? (row.sdcId as string)} amended`,
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
      // The flag is judged by the guards below; the free type is the order line's.
      await this.freeFromOrders(tx, saveDto as SaveDeliveryChallanDto, false);
      applyDcLineLevels(saveDto as SaveDeliveryChallanDto);
      const saved = await this.store.saveDraft(
        tx,
        { ...this.draftRow(saveDto as SaveDeliveryChallanDto), sdcId: keys.id },
        ctx.actor,
        now,
        // The amend files ONE revision below, after the re-post; the header GST
        // split comes from the stored lines (P6 R2).
        { revision: true, afterWrite: this.headerSplitHook(tx, ctx.actor, now) },
      );
      const newItems = await this.store.loadItems(tx, saved);
      const g = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.guards(tx, saved, newItems, ctx, g, items);
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
      // The re-post re-derived the reservations of its new lines; a line the
      // amend dropped is re-derived here (once, at the end: no give-back at
      // the DRAFT step, so an unchanged line is not handed over and re-taken).
      await this.rederiveReservations(tx, items, ctx.actor, now);
      await this.writeRevision(
        tx,
        keys,
        before,
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
    if (items.some((i) => dec(i.sdiBilledQty as Prisma.Decimal).greaterThan(0))) {
      throwSalesLocked(
        'A bill has been raised against this challan — cancel the bill first',
        SALES_ERROR_CODES.DC_BILLED,
        'sdcId',
      );
    }
    if (items.some((i) => dec(i.sdiReturnedQty as Prisma.Decimal).greaterThan(0))) {
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
    mode: 'cancel' | 'amend' = 'cancel',
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
      // An amend RETIRES the row so the re-post can file the same challan again
      // (uq_acc_voucher_doc_register_source holds a CANCELED row: the re-post
      // answered 23505, found live 2026-11-16), as the bill and the Sale Return
      // do (DocRegisterService.retire); a cancel marks it CANCELED.
      if (mode === 'amend') {
        await this.register.retire(tx, gdrId, keys.accYear, actor);
      } else {
        await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
      }
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
      // Decision 34 — converting the purpose is an EDIT of the posted challan.
      if (!ctx.rights.edit) {
        throwSalesRight('This user may not edit on this menu', SALES_ERROR_CODES.RIGHT_EDIT);
      }
      const gdrId = await this.register.registerIdOf(
        tx,
        row.sdcId as string,
        row.sdcAccYear as string,
      );
      // The purpose became the e-way bill's sub-supply type: declared, locked.
      await assertBandWritable(tx, gdrId);
      // P6 S1: its lines locked (after the header) before their billed /
      // returned caches are read: a bill or a return of it holds them.
      await lockDcLines(tx, row.sdcId as string, row.sdcAccYear as string);
      const items = await this.store.loadItems(tx, row);
      const { billed, returned, open } = dcDisposalOf(items);
      if (billed) {
        throwSalesLocked(
          'This challan has been billed against — its purpose decided what that bill became',
          SALES_ERROR_CODES.DC_BILLED,
          'purpose',
        );
      }
      if (returned && !open) {
        // P6 N3: everything came back (it said SALES_DC_BILLED before).
        throwSalesLocked(
          'Everything on this challan has come back: nothing is left to convert',
          SALES_ERROR_CODES.DC_RETURNED,
          'purpose',
          { rule: 'NOTHING_OPEN' },
        );
      }
      if (returned && dto.purpose !== 'SUPPLY') {
        // P6 Q1 (user 11-17, "do all recommended"): a partly returned challan
        // converts to SUPPLY only, so its remainder can be billed.
        throwSalesLocked(
          `Goods have come back against this challan: only what is left on it converts, and only to SUPPLY (not ${dto.purpose})`,
          SALES_ERROR_CODES.DC_RETURNED,
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

  /** §8.2 `PUT /transport` (EDIT): the band; answers the /get payload. */
  async transport(dto: DeliveryChallanTransportDto): Promise<Record<string, unknown>> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.assertRight('edit', tx);
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
      await this.transportBand.write(
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
    }, TX);
    return this.get(this.keys(dto));
  }
}

/**
 * A posted challan line's unit cost per ITS unit (sdi_cost_price, 4 places):
 * the engine's per-base rate × the line's to-base factor; where the engine
 * gave no rate, the line's cost total ÷ (qty + free). Decimal throughout.
 */
export function dcUnitCostOf(
  i: DocRow,
  stock: { costByLine: Map<string, number>; rateByLine?: Map<string, Prisma.Decimal> },
): Prisma.Decimal {
  const id = i.sdiId as string;
  const factor = dec(i.sdiToBaseFactor as Prisma.Decimal);
  const perBase = stock.rateByLine?.get(id);
  if (perBase !== undefined) {
    return perBase
      .times(factor.isZero() ? 1 : factor)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  }
  const units = dec(i.sdiDcQty as Prisma.Decimal).plus(dec(i.sdiFreeQty as Prisma.Decimal));
  return units.isZero()
    ? new Prisma.Decimal(0)
    : new Prisma.Decimal(stock.costByLine.get(id) ?? 0)
        .dividedBy(units)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * The record a revision keeps: the /get payload less what is not the
 * document (the caller's rights, the lock flags) and the derived names.
 */
function dcAuditRecordOf(doc: Record<string, unknown>): Record<string, unknown> {
  const { locks: _locks, rights: _rights, ageDays: _a, ageLevel: _l, ...record } = doc;
  void _locks;
  void _rights;
  void _a;
  void _l;
  const items = Array.isArray(record.items) ? (record.items as Record<string, unknown>[]) : [];
  return {
    ...record,
    items: items.map((i) => {
      const { itemName: _i, itemCode: _c, unitName: _u, godownName: _g, lotNo: _n, unitKg: _k, ...line } = i;
      void _i;
      void _c;
      void _u;
      void _g;
      void _n;
      void _k;
      return line;
    }),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}

/**
 * What has become of a challan's lines: anything billed, anything returned, and
 * anything still out (dc − billed − returned > 0, as GENERATED sdi_open_qty).
 */
export function dcDisposalOf(items: readonly DocRow[]): {
  billed: boolean;
  returned: boolean;
  open: boolean;
} {
  let billed = false;
  let returned = false;
  let open = false;
  for (const i of items) {
    const b = dec(i.sdiBilledQty as Prisma.Decimal);
    const r = dec(i.sdiReturnedQty as Prisma.Decimal);
    billed = billed || b.greaterThan(0);
    returned = returned || r.greaterThan(0);
    open = open || dec(i.sdiDcQty as Prisma.Decimal).minus(b).minus(r).greaterThan(0);
  }
  return { billed, returned, open };
}

/** P6 N1 / R2: the header GST split as its lines make it (2 places, Decimal). */
export function dcHeaderSplitOf(items: readonly DocRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [h, l] of DC_HEADER_SPLIT) {
    out[h] = items.reduce<Prisma.Decimal>((a, i) => a.plus(dec(i[l] as Prisma.Decimal)), dec(0)).toFixed(2);
  }
  return out;
}

/** The order draws of challan lines, in base units. */
function dcItemDraws(items: DocRow[]): OrderDraw[] {
  return items
    .filter((i) => i.sdiSrcDocType === 'SALES_ORDER')
    .map((i) => {
      const factor = new Prisma.Decimal((i.sdiToBaseFactor as Prisma.Decimal.Value | null) ?? 0);
      return {
        soId: (i.sdiSrcDocId as string | null) ?? null,
        soiId: (i.sdiSrcItemId as string | null) ?? null,
        baseQty: new Prisma.Decimal((i.sdiDcQty as Prisma.Decimal.Value | null) ?? 0).times(
          factor.isZero() ? 1 : factor,
        ),
      };
    });
}

/**
 * Locks the sales orders a challan names — on its header(s) and on its lines,
 * by order id and by order-line id — before any stock write (lockSourceOrders).
 */
async function lockDcOrders(
  tx: Prisma.TransactionClient,
  headers: DocRow[],
  lines: DocRow[],
): Promise<void> {
  const ids = new Set<string>();
  const lineIds = new Set<string>();
  for (const h of headers) {
    if (h.sdcSrcDocType === 'SALES_ORDER' && h.sdcSrcDocId) {
      ids.add(h.sdcSrcDocId as string);
    }
  }
  for (const l of lines) {
    if (l.sdiSrcDocType !== 'SALES_ORDER') {
      continue;
    }
    if (l.sdiSrcDocId) {
      ids.add(l.sdiSrcDocId as string);
    }
    if (l.sdiSrcItemId) {
      lineIds.add(l.sdiSrcItemId as string);
    }
  }
  await lockSourceOrders(tx, [...ids], [...lineIds]);
}
