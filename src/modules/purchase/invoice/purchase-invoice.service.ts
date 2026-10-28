import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { VoucherPostingService } from 'src/common/posting/voucher-posting.service';
import type { VoucherLeg } from 'src/common/posting/voucher-leg.types';
import { StockPostingService } from 'src/modules/stocks/posting/stock-posting.service';
import { StockVoucherSource } from 'src/modules/stocks/posting/stock-voucher.source';
import { nextStockVoucherSlno, resolveDeviceCode } from 'src/modules/stocks/stock-voucher/stock-voucher-numbering.helper';
import type { StockVoucherTypeRules } from 'src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { revalueOnHand, reverseCostRevaluation, type CostRevaluationLine } from 'src/modules/stocks/stock-voucher/stock-voucher-posting.helper';
import { recordSupplierItems } from '../supplier-item/purchase-supplier-item';
import { calcPurchase, type CalcChargeIn, type CalcOut, type ItcClass } from '../common/purchase-calc';
import { PUR, purConflict, purNotFound, purRefuse, purRefuseMany } from '../common/purchase.errors';
import {
  allocateDocNumber, assertBillsUnsettled, assertNoLiveReturns, assertShortagesUntouched, numberTextileBatches, payeeLedgers, raiseBillRow, writeTextileDetails, statusLog, voucherTypeId, withdrawBillRows,
} from '../common/purchase-doc.helpers';
import type { SavePurchaseInvoiceDto, PurchaseInvoiceLineDto, CancelPurchaseInvoiceDto, GrnLinesQueryDto } from './dto/save-purchase-invoice.dto';

/**
 * Purchase Invoice — save (draft), save + post, get, preview, cancel.
 * plan-purchase-backend.md B6 (direct bill slice). The calculation is
 * `calcPurchase` and nothing else: the client's figures are a preview, these
 * are the ones stored and posted.
 *
 * POST, in one transaction:
 *   1  stock   a shadow RECEIPT stock voucher (`svh_link_src_* = PURCHASE /
 *              PURCHASE_BILL / pi_id`), one `svi` per allocation row, cost =
 *              the landed cost WITHOUT recoverable GST per base unit (D4).
 *              The engine resolves the lots; they are written back to
 *              `pia_lot_id`.
 *   2  books   Dr INVENTORY (landed value) · Dr INPUT_* (eligible GST) ·
 *              Dr INPUT_TAX_PENDING (GST of the short) · Dr SHORTAGE_RECEIVABLE ·
 *              Dr non-landing on-bill charges · Dr TCS_RECEIVABLE · round off ·
 *              Cr supplier (net payable) · Cr each off-bill payee.
 *   3  bills   acc_bill_balance PURCHASE (CR) for the supplier and each payee.
 *   4  short   a pur_shortage row per line with a pending short.
 *   5  log     txn_status_log POSTED.
 *
 * A line billed off a GRN line (`grnItemId`, R4 / R5) has no stock voucher —
 * the goods came in on the GRN at its provisional value. Its books are
 * Dr GRNI (the GRN line's provisional value) and the difference to the bill's
 * landed value split by R2: the share still on hand → INVENTORY (value-only
 * revaluation rows, P13 `revalueOnHand`), the rest → PURCHASE_PRICE_VARIANCE.
 * The GRN's challan-short row is ADOPTED (R3): value + pending GST set on it,
 * never a second row.
 *
 * R18 — a GRN line with goods sent back on a GRN return: KEPT = received +
 * damaged − returned. The bill must cover what was kept; what it bills beyond
 * that, up to the returned qty, is REJECTED (pii_rejected_at_grn_qty). Post
 * then writes the debit note for it in the same transaction: a PURCHASE_RETURN
 * against this bill, no stock (the goods left on the GRN return), money per
 * billed unit of the line with its GST — Dr Supplier / Cr GRNI / Cr input GST.
 * The bill debits GRNI by the same value, so GRNI nets out exactly; only the
 * kept qty is revalued against the GRN value still open. That debit note is
 * the bill's: it is recognised by having no allocation rows, and it is
 * cancelled with the bill, never on its own.
 *
 * Still refused: a draft GRN return on the line, a challan short already
 * received / closed, billing less than was kept, off-bill charges.
 */

const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const num = (v: Prisma.Decimal) => Number(v.toFixed(2));
const DOC_TYPE = 'PURCHASE_BILL';
const SRC_MODULE = 'PURCHASE';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Prisma.TransactionClient;

interface SupplierRow { sup_id: string; sup_name: string; sup_state_code: string | null; sup_gst_type: string | null; sup_gst_no: string | null; sup_credit_days: number | null }
interface ItemRow { iuc_id: string; iuc_item_id: string; iuc_to_base_factor: Prisma.Decimal; base_iuc_id: string; item_default_tax_id: string | null; item_hsn_code: string | null; item_itc_class: string | null; item_shortage_pct: Prisma.Decimal | null; item_name: string | null }
interface TaxRow { tax_id: string; tax_rate_perc: Prisma.Decimal; tax_cess_perc: Prisma.Decimal | null; tax_cess_per_unit: Prisma.Decimal | null }
interface ChargeRow { chg_id: string; chg_name: string; chg_type: string; chg_method: string; chg_default_rate: Prisma.Decimal | null; chg_cost_alloc: string | null; chg_before_tax: boolean; chg_tax_apl: boolean; chg_landing_cost: boolean; chg_on_bill: boolean; chg_ledger_code: string; chg_role: string | null; tax_rate_perc: Prisma.Decimal | null; chg_tax_id: string | null }

/** The GRN line a bill line bills — read at save (prepare) and again at post. */
interface GrnFacts {
  gri_id: string; gri_acc_year: string; gri_line_no: number; gri_item_id: string; gri_uom_id: string;
  gri_received_qty: Prisma.Decimal; gri_damaged_qty: Prisma.Decimal; gri_free_qty: Prisma.Decimal; gri_challan_qty: Prisma.Decimal;
  gri_to_base_factor: Prisma.Decimal; gri_value: Prisma.Decimal; gri_offbill_share: Prisma.Decimal;
  grn_id: string; grn_refno: string; grn_doc_date: Date; grn_status: string; grn_company_id: string; grn_branch_id: string; grn_supplier_id: string;
  billed_in: string | null; draft_return: string | null; short_touched: bigint;
  /** posted GRN returns of the line: paid qty, free qty (line unit), and the GRNI value they took off */
  returned_qty: Prisma.Decimal; returned_free: Prisma.Decimal; returned_value: Prisma.Decimal;
  /** set by prepare: of the returned qty, how much this bill bills (→ its debit note) */
  rejected_billed?: Prisma.Decimal;
}

interface Prepared {
  supplier: SupplierRow;
  interState: boolean;
  taxMode: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED';
  items: Map<string, ItemRow>;
  taxes: Map<string, TaxRow>;
  charges: ChargeRow[];
  calc: CalcOut;
  /** lineNo → the GRN line it bills */
  grn: Map<number, GrnFacts>;
  allocs: Map<number, { godownId: string; bucket: string; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; mrp: number | null; salePrice: number | null; serialNo: string | null; warrantyTo: string | null; sizeId: string | null; colourId: string | null; model: string | null; qty: Prisma.Decimal; freeQty: Prisma.Decimal }[]>;
}

@Injectable()
export class PurchaseInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly vouchers: VoucherPostingService,
    private readonly stockPosting: StockPostingService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  preview — the calculation only, nothing written
  // ═══════════════════════════════════════════════════════════════════════
  async preview(dto: SavePurchaseInvoiceDto) {
    const p = await this.prepare(this.prisma as unknown as Tx, dto);
    return this.calcPayload(p, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  save (draft) / save + post
  // ═══════════════════════════════════════════════════════════════════════
  async save(dto: SavePurchaseInvoiceDto) {
    const actor = this.actor();
    const h = dto.header;
    const piId = await this.prisma.$transaction(
      async (tx) => {
        const p = await this.prepare(tx, dto);
        await this.assertNotDuplicate(tx, dto);
        if (h.post) this.assertPrintedAmount(p, dto);

        let id = h.piId ?? null;
        let slno: bigint, refno: string, fromStatus: string | null = null;
        if (id) {
          const cur = await tx.purInvoice.findFirst({ where: { piId: id, piAccYear: h.accYear, piIsDeleted: false } });
          if (!cur) purNotFound(`Purchase invoice ${id} not found`);
          if (cur.piStatus !== 'DRAFT') purConflict(`${cur.piRefno} is ${cur.piStatus} — only a draft can be edited.`, PUR.NOT_DRAFT, 'piId');
          slno = cur.piSlno; refno = cur.piRefno; fromStatus = 'DRAFT';
          await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC_TYPE, piaDocId: id, piaAccYear: h.accYear } });
          await tx.purInvoiceItem.deleteMany({ where: { piiPiId: id, piiAccYear: h.accYear } });
          await tx.$executeRaw`DELETE FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC_TYPE} AND cd_doc_id = ${id}::uuid AND cd_acc_year = ${h.accYear}::bpchar`;
        } else {
          ({ slno, refno } = await this.allocateNumber(tx, h.companyId, h.branchId, h.accYear, h.deviceId));
        }
        id = await this.writeDocument(tx, dto, p, id, slno, refno, actor);
        if (!fromStatus) {
          await this.log(tx, dto, id, refno, TxnStatusEvent.CREATED, null, 'DRAFT', actor);
        }
        if (h.post) await this.postInTx(tx, id, h.accYear, actor);
        return id;
      },
      { timeout: 60000, maxWait: 10000 },
    );
    return this.get(piId, h.accYear);
  }

  async post(piId: string, accYear: string) {
    const actor = this.actor();
    await this.prisma.$transaction((tx) => this.postInTx(tx, piId, accYear, actor), { timeout: 60000, maxWait: 10000 });
    return this.get(piId, accYear);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  get
  // ═══════════════════════════════════════════════════════════════════════
  async get(piId: string, accYear: string) {
    const header = await this.prisma.purInvoice.findFirst({ where: { piId, piAccYear: accYear, piIsDeleted: false } });
    if (!header) purNotFound(`Purchase invoice ${piId} not found`);
    const [lines, allocs, charges, supplier] = await Promise.all([
      this.prisma.purInvoiceItem.findMany({ where: { piiPiId: piId, piiAccYear: accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } }),
      this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC_TYPE, piaDocId: piId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: [{ piaRowNo: 'asc' }] }),
      this.prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT cd.cd_chg_id AS "chgId", cd.cd_chg_name AS "chgName", cd.cd_on_bill AS "onBill", cd.cd_before_tax AS "beforeTax",
               cd.cd_method AS "method", cd.cd_type AS "type", cd.cd_tax_perc AS "taxPct",
               cd.cd_landing_cost AS "landingCost", cd.cd_rate AS "rate", cd.cd_amount AS "amount", cd.cd_party_id AS "partyId",
               l.led_name AS "partyName", cd.cd_cgst_amt AS "cgst", cd.cd_sgst_amt AS "sgst", cd.cd_igst_amt AS "igst"
          FROM public.txn_charge_detail cd
          LEFT JOIN accounts.acc_ledger_master l ON l.led_id = cd.cd_party_id
         WHERE cd.cd_doc_type = ${DOC_TYPE} AND cd.cd_doc_id = ${piId}::uuid AND cd.cd_acc_year = ${accYear}::bpchar AND cd.cd_is_deleted = false
         ORDER BY cd.cd_slno`,
      this.prisma.$queryRaw<{ sup_name: string }[]>`SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.piSupplierId}::uuid`,
    ]);
    const byLine = new Map<string, typeof allocs>();
    for (const a of allocs) byLine.set(a.piaLineId, [...(byLine.get(a.piaLineId) ?? []), a]);
    return jsonSafe({
      header: { ...header, supplierName: supplier[0]?.sup_name ?? null },
      lines: lines.map((l) => ({ ...l, allocs: byLine.get(l.piiId) ?? [] })),
      charges,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  cancel — a posted bill nothing has settled
  // ═══════════════════════════════════════════════════════════════════════
  async cancel(dto: CancelPurchaseInvoiceDto) {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.purInvoice.findFirst({ where: { piId: dto.piId, piAccYear: dto.accYear, piIsDeleted: false } });
      if (!cur) purNotFound(`Purchase invoice ${dto.piId} not found`);
      if (cur.piStatus !== 'POSTED') purConflict(`${cur.piRefno} is ${cur.piStatus} — only a posted bill can be cancelled.`, PUR.NOT_POSTED, 'piId');
      // §3.8 — nothing may have settled it: a payment / adjustment allocation on any of its bill rows
      const [paid] = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM accounts.acc_bill_balance
         WHERE abl_src_module = ${SRC_MODULE} AND abl_src_doc_type = ${DOC_TYPE} AND abl_src_doc_id = ${dto.piId}::uuid
           AND abl_is_deleted = false AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
      if (Number(paid.n) > 0) {
        purConflict(`${cur.piRefno} is already paid or adjusted — undo the payment allocation first, or enter a debit note.`, PUR.EDIT_LOCKED_PAID, 'piId');
      }
      await this.cancelRejectedDebitNotes(tx, dto.piId, cur.piRefno, dto.reason, actor);   // R18: the bill's own note goes with it
      await assertNoLiveReturns(tx, dto.piId, cur.piRefno);
      await assertShortagesUntouched(tx, dto.piId, cur.piRefno);
      const cancelledOn = new Date();
      const rules = this.stockRules();
      const shadows = await tx.$queryRaw<{ svh_id: string }[]>`
        SELECT svh_id FROM stock.stock_voucher
         WHERE svh_link_src_module = ${SRC_MODULE} AND svh_link_src_doc_type = ${DOC_TYPE}
           AND svh_link_src_doc_id = ${dto.piId}::uuid AND svh_acc_year = ${dto.accYear}::bpchar
           AND svh_status = 'POSTED' AND svh_is_deleted = false`;
      for (const s of shadows) {
        await this.stockPosting.cancel(
          tx,
          new StockVoucherSource({ svhId: s.svh_id, accYear: dto.accYear, companyId: cur.piCompanyId, branchId: cur.piBranchId, rules }),
          { actor, reason: dto.reason, cancelledOn: new Date() },
        );
      }
      if (cur.piPostedVoucherId) {
        await this.vouchers.reverseLegs(tx, cur.piPostedVoucherId, dto.accYear, `Purchase ${cur.piRefno} cancelled: ${dto.reason}`, actor);
      }
      // GRN lines: the revaluation comes out of what is still on hand; what already left stock stays a variance
      const docDate = isoDate(cancelledOn);
      const { forward, reversed } = await reverseCostRevaluation(tx,
        { companyId: cur.piCompanyId, branchId: cur.piBranchId, accYear: dto.accYear, srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcDocId: dto.piId,
          srcAccYear: dto.accYear, docDate, narration: `Purchase ${cur.piRefno} cancelled: ${dto.reason}` },
        actor, cancelledOn);
      const left = forward.plus(reversed);   // the mirror took `forward` out of INVENTORY; only −`reversed` left stock
      if (!left.toDecimalPlaces(2).isZero()) {
        // a journal of its own series — the PUR series is the bills' own numbers (presetNo = pi_slno)
        const [vt] = await tx.$queryRaw<{ id: number }[]>`SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Jrl' AND vchr_is_active LIMIT 1`;
        if (!vt) purRefuse('Voucher type Jrl (Journal) is missing.', PUR.VOUCHER_TYPE_MISSING);
        const amt = Math.abs(num(left));
        await this.vouchers.postLegs(tx, {
          header: {
            companyId: cur.piCompanyId, branchId: cur.piBranchId, accYear: dto.accYear, voucherTypeId: vt.id, voucherDate: docDate,
            srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcDocId: dto.piId, docLabel: 'Purchase revaluation', docRefno: `${cur.piRefno}/RV`, docDate,
            usrRefno: cur.piSupplierInvNo, docAmount: amt, partyId: cur.piSupplierId, userId: actor, sessionId: cur.piSessionId, deviceId: cur.piDeviceId,
            remarks: `Purchase ${cur.piRefno} cancelled — revaluation of stock already sold stays`, createdBy: actor,
          },
          legs: [
            { role: 'INVENTORY', drCr: left.greaterThan(0) ? 'DR' : 'CR', amount: amt, roleTag: 'INVENTORY', remarks: `Revaluation still in stock · ${cur.piRefno}` },
            { role: 'PURCHASE_PRICE_VARIANCE', drCr: left.greaterThan(0) ? 'CR' : 'DR', amount: amt, roleTag: 'PURCHASE_PRICE_VARIANCE', remarks: `Bill vs GRN rate on stock already out · ${cur.piRefno}` },
          ],
        });
      }
      // R3: a GRN challan short this bill adopted goes back to the GRN, qty-only
      await tx.$executeRaw`
        UPDATE purchase.pur_shortage s
           SET psh_reason = 'SHORT_CHALLAN', psh_bill_doc_id = NULL, psh_bill_doc_year = NULL, psh_bill_item_id = NULL,
               psh_qty_base = (gri.gri_challan_qty - gri.gri_received_qty - gri.gri_damaged_qty) * gri.gri_to_base_factor,
               psh_value = NULL, psh_gst_pending = NULL,
               psh_origin_cost_rate = CASE WHEN (gri.gri_received_qty + gri.gri_damaged_qty + gri.gri_free_qty) * gri.gri_to_base_factor = 0 THEN 0
                 ELSE ROUND((gri.gri_value + gri.gri_offbill_share) / ((gri.gri_received_qty + gri.gri_damaged_qty + gri.gri_free_qty) * gri.gri_to_base_factor), 6) END,
               psh_is_deleted = false, psh_modified_by = ${actor}, psh_modified_on = ${cancelledOn}
          FROM purchase.pur_grn_item gri
         WHERE s.psh_bill_doc_id = ${dto.piId}::uuid AND s.psh_bill_doc_year = ${dto.accYear}::bpchar
           AND s.psh_src_doc_type = 'GRN' AND gri.gri_id = s.psh_src_item_id AND gri.gri_acc_year = s.psh_src_doc_year`;
      await tx.accBillBalance.updateMany({
        where: { ablSrcModule: SRC_MODULE, ablSrcDocType: DOC_TYPE, ablSrcDocId: dto.piId, ablIsDeleted: false },
        data: { ablIsDeleted: true, ablModifiedBy: actor },
      });
      await tx.purShortage.updateMany({
        where: { pshSrcDocType: DOC_TYPE, pshSrcDocId: dto.piId, pshIsDeleted: false },
        data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() },
      });
      await tx.purInvoice.update({
        where: { piId_piAccYear: { piId: dto.piId, piAccYear: dto.accYear } },
        data: { piStatus: 'CANCELLED', piModifiedBy: actor, piModifiedOn: new Date() },
      });
      await appendTxnStatusLog(tx, {
        companyId: cur.piCompanyId, branchId: cur.piBranchId, accYear: dto.accYear,
        srcModule: TxnStatusSrcModule.PURCHASE, srcDocType: TxnStatusDocType.PURCHASE_BILL, srcDocId: dto.piId,
        srcDocRefno: cur.piRefno, event: TxnStatusEvent.CANCELLED, fromStatus: 'POSTED', toStatus: 'CANCELLED',
        changedBy: actor, remarks: dto.reason, deviceId: cur.piDeviceId,
      });
    }, { timeout: 60000, maxWait: 10000 });
    return this.get(dto.piId, dto.accYear);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  internals
  // ═══════════════════════════════════════════════════════════════════════
  private actor(): string {
    const u = this.requestContext.getUserId();
    if (!u) purRefuse('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
    return u;
  }

  /** Reads every master the calculation needs and runs it. Refuses what cannot be priced. */
  private async prepare(tx: Tx, dto: SavePurchaseInvoiceDto): Promise<Prepared> {
    const h = dto.header;
    if ((h.mode ?? 'CREDIT') !== 'CREDIT') {
      purRefuse('Cash purchase is not built yet — enter it as Credit and pay it in Payment.', PUR.MODE_NOT_SUPPORTED, 'header.mode');
    }
    const [supplier] = await tx.$queryRaw<SupplierRow[]>`
      SELECT sup_id, sup_name, sup_state_code, sup_gst_type, sup_gst_no, sup_credit_days
        FROM purchase.suppliers WHERE sup_id = ${h.supplierId}::uuid AND sup_is_deleted = false`;
    if (!supplier) purNotFound(`Supplier ${h.supplierId} not found`, PUR.SUPPLIER_NOT_FOUND, 'header.supplierId');
    const [branch] = await tx.$queryRaw<{ state: string | null }[]>`
      SELECT COALESCE(NULLIF(trim(b.br_state_code), ''), NULLIF(trim(c.comp_state_code), '')) AS state
        FROM public.branch_master b JOIN public.companys c ON c.comp_id = b.br_comp_id
       WHERE b.br_id = ${h.branchId}::uuid`;
    const ourState = (branch?.state ?? '').trim();
    const theirState = (supplier.sup_state_code ?? '').trim() || (supplier.sup_gst_no ?? '').slice(0, 2);
    const interState = !!ourState && !!theirState && ourState !== theirState;
    const gt = (supplier.sup_gst_type ?? 'REGULAR').toUpperCase();
    const taxMode = gt.startsWith('COMP') ? 'COMPOSITION' : gt.startsWith('UNREG') ? 'UNREGISTERED' : 'REGULAR';

    const uomIds = [...new Set(dto.lines.map((l) => l.uomId))];
    const items = new Map(
      (
        await tx.$queryRaw<ItemRow[]>`
        SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor,
               COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id,
               im.item_default_tax_id, im.item_hsn_code, im.item_itc_class, im.item_shortage_pct, im.item_name_en AS item_name
          FROM inventory.item_unit_conversion iuc
          JOIN inventory.item_master im ON im.item_id = iuc.iuc_item_id
          LEFT JOIN LATERAL (SELECT b.iuc_id FROM inventory.item_unit_conversion b
                              WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit AND NOT b.iuc_is_deleted
                              ORDER BY b.iuc_unit_slno LIMIT 1) base ON true
         WHERE iuc.iuc_id = ANY(${uomIds}::uuid[]) AND NOT iuc.iuc_is_deleted`
      ).map((r) => [r.iuc_id, r]),
    );
    const problems: { field: string; code: string; message: string }[] = [];
    const grn = await this.loadGrnLines(tx, dto, problems);
    dto.lines.forEach((l, i) => {
      const it = items.get(l.uomId);
      if (!it) problems.push({ field: `lines.${i}.uomId`, code: PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit ${l.uomId} not found` });
      else if (it.iuc_item_id !== l.itemId) problems.push({ field: `lines.${i}.uomId`, code: PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: the unit belongs to another item` });
      const billed = D(l.billedQty), recd = l.receivedQty === undefined ? null : D(l.receivedQty), dmg = D(l.damagedQty);
      if (billed.isZero() && D(l.freeQty).isZero()) problems.push({ field: `lines.${i}.billedQty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: no qty` });
      if (recd && recd.plus(dmg).greaterThan(billed)) problems.push({ field: `lines.${i}.receivedQty`, code: PUR.QTY_INVALID, message: `Line ${l.lineNo}: received + damaged is more than billed — enter the excess separately` });
    });
    // a line without a tax id takes the item's default rate
    for (const l of dto.lines) if (!l.taxId) l.taxId = items.get(l.uomId)?.item_default_tax_id ?? undefined;
    const taxIds = [...new Set(dto.lines.map((l) => l.taxId).filter((t): t is string => !!t))];
    const taxes = new Map(
      (
        taxIds.length
          ? await tx.$queryRaw<TaxRow[]>`SELECT tax_id, tax_rate_perc, tax_cess_perc, tax_cess_per_unit FROM inventory.tax_rate_master WHERE tax_id = ANY(${taxIds}::uuid[])`
          : []
      ).map((t) => [t.tax_id, t]),
    );
    const chgIds = [...new Set((dto.charges ?? []).map((c) => c.chgId))];
    const charges = chgIds.length
      ? await tx.$queryRaw<ChargeRow[]>`
          SELECT c.chg_id, c.chg_name, c.chg_type, c.chg_method, c.chg_default_rate, c.chg_cost_alloc, c.chg_before_tax,
                 c.chg_tax_apl, c.chg_landing_cost, c.chg_on_bill, c.chg_ledger_code, c.chg_role, c.chg_tax_id, t.tax_rate_perc
            FROM public.charge_master c LEFT JOIN inventory.tax_rate_master t ON t.tax_id = c.chg_tax_id
           WHERE c.chg_id = ANY(${chgIds}::uuid[]) AND c.chg_is_deleted = false AND c.chg_module IN ('P','B')`
      : [];
    const chgById = new Map(charges.map((c) => [c.chg_id, c]));
    // loadmen are picked as employees: each is owed on his own staff ledger (as on the GRN)
    for (const [i, c] of (dto.charges ?? []).entries()) if (c.payees?.length) c.payees = await payeeLedgers(tx, c.payees, `charges.${i}.payees`);
    const calcCharges: CalcChargeIn[] = [];
    const payeeIds = new Set<string>();
    (dto.charges ?? []).forEach((c, i) => {
      const m = chgById.get(c.chgId);
      if (!m) { problems.push({ field: `charges.${i}.chgId`, code: PUR.CHARGE_NOT_FOUND, message: `Charge ${c.chgId} is not a purchase charge` }); return; }
      if (!m.chg_on_bill && grn.size) {
        problems.push({ field: `charges.${i}.chgId`, code: PUR.GRN_OFFBILL_REFUSED, message: `${m.chg_name}: our own (off-bill) charges stay on the GRN — a bill from a GRN takes only the supplier's charges` });
      }
      if (!m.chg_on_bill && !(c.payees?.length) && !m.chg_ledger_code) {
        problems.push({ field: `charges.${i}.payees`, code: PUR.OFFBILL_NO_PAYEE, message: `${m.chg_name}: say who is owed (pick the loadmen / party)` });
      }
      c.payees?.forEach((p) => payeeIds.add(p.partyId));
      calcCharges.push({
        key: String(i), type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD',
        method: (m.chg_method as CalcChargeIn['method']) ?? 'FIXED',
        rate: c.rate ?? m.chg_default_rate ?? 0, amount: c.amount ?? null,
        alloc: ((m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE') as CalcChargeIn['alloc']),
        beforeTax: m.chg_on_bill ? m.chg_before_tax : false,
        onBill: m.chg_on_bill,
        landingCost: m.chg_on_bill ? m.chg_landing_cost : true, // D13: off-bill is always landing cost
        taxPct: m.chg_on_bill && m.chg_tax_apl && !m.chg_before_tax ? (m.tax_rate_perc ?? 0) : 0, // D14: off-bill no GST
        payees: m.chg_on_bill ? [] : (c.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })),
      });
    });
    if (payeeIds.size) {
      const led = await tx.$queryRaw<{ led_id: string; led_name: string; led_is_reverse_charge: boolean | null }[]>`
        SELECT led_id, led_name, led_is_reverse_charge FROM accounts.acc_ledger_master WHERE led_id = ANY(${[...payeeIds]}::uuid[]) AND NOT led_is_deleted`;
      const ok = new Map(led.map((l) => [l.led_id, l]));
      for (const id of payeeIds) {
        const l = ok.get(id);
        if (!l) problems.push({ field: 'charges', code: PUR.OFFBILL_NO_PAYEE, message: `Payee ledger ${id} not found` });
        else if (l.led_is_reverse_charge) problems.push({ field: 'charges', code: PUR.OFFBILL_GTA_REFUSED, message: `${l.led_name} is a reverse-charge (GTA) party — enter its bill in Expense Voucher (RCM).` });
      }
    }
    if (problems.length) purRefuseMany(problems[0].message, problems);

    const calc = calcPurchase({
      interState,
      supplierTaxMode: taxMode,
      tcsAmount: h.tcsAmount ?? 0,
      roundOffStep: 1,
      charges: calcCharges,
      lines: dto.lines.map((l) => {
        const it = items.get(l.uomId)!;
        const tax = l.taxId ? taxes.get(l.taxId) : undefined;
        return {
          key: String(l.lineNo), billedQty: l.billedQty, receivedQty: l.receivedQty ?? null, damagedQty: l.damagedQty ?? 0,
          freeQty: l.freeQty ?? 0, toBaseFactor: it.iuc_to_base_factor, rate: l.rate,
          discPct: l.discPct, discPerQty: l.discPerQty, discAmt: l.discAmt, schPct: l.schPct, schPerQty: l.schPerQty, schAmt: l.schAmt,
          extraDiscAmt: l.extraDiscAmt, gstPct: tax?.tax_rate_perc ?? 0,
          cessPct: l.cessPct ?? tax?.tax_cess_perc ?? 0, cessPerUnit: l.cessPerUnit ?? tax?.tax_cess_per_unit ?? 0,
          weight: l.weight ?? 0, itcClass: (it.item_itc_class as ItcClass | null) ?? 'ELIGIBLE', shortagePct: it.item_shortage_pct ?? 0,
        };
      }),
    });

    // allocation rows: given ones must add up to what came in; else one SALEABLE + one DAMAGED row in the header godown
    const allocs: Prepared['allocs'] = new Map();
    const allocProblems: { field: string; code: string; message: string }[] = [];
    dto.lines.forEach((l, i) => {
      const out = calc.lines[i];
      if (grn.has(l.lineNo)) { allocs.set(l.lineNo, []); return; }   // stock came in on the GRN
      const recd = l.receivedQty === undefined || l.receivedQty === null ? D(l.billedQty).minus(D(l.damagedQty)) : D(l.receivedQty);
      const dmg = D(l.damagedQty), free = D(l.freeQty);
      if (l.allocs && l.allocs.length) {
        const rows = l.allocs.map((a) => ({
          godownId: a.godownId ?? h.godownId, bucket: a.bucket ?? 'SALEABLE', batchNo: a.batchNo?.trim() || null,
          mfgDate: a.mfgDate ?? null, expiryDate: a.expiryDate ?? null, mrp: a.mrp ?? l.mrp ?? null, salePrice: a.salePrice ?? l.sellA ?? null,
          serialNo: a.serialNo?.trim() || null, warrantyTo: a.warrantyTo ?? null, sizeId: a.sizeId ?? null, colourId: a.colourId ?? null,
          model: a.model?.trim() || null, qty: D(a.qty), freeQty: D(a.freeQty),
        }));
        const sum = rows.reduce((s, r) => s.plus(r.qty).plus(r.freeQty), ZERO);
        const want = recd.plus(dmg).plus(free);
        if (!sum.equals(want)) {
          allocProblems.push({ field: `lines.${i}.allocs`, code: PUR.ALLOC_SUM_MISMATCH, message: `Line ${l.lineNo}: the batch split adds up to ${sum.toString()}, it must be ${want.toString()} (received + damaged + free)` });
        }
        rows.forEach((r, k) => {
          if (r.serialNo && !r.qty.plus(r.freeQty).equals(1)) {
            allocProblems.push({ field: `lines.${i}.allocs.${k}.qty`, code: PUR.SERIAL_COUNT, message: `Line ${l.lineNo}: a serial-number row is one piece` });
          }
        });
        allocs.set(l.lineNo, rows);
      } else {
        const base = { godownId: h.godownId, batchNo: null, mfgDate: null, expiryDate: null, mrp: l.mrp ?? null, salePrice: l.sellA ?? null, serialNo: null, warrantyTo: null, sizeId: null, colourId: null, model: null };
        const rows: ReturnType<Prepared['allocs']['get']> & object = [];
        if (recd.plus(free).greaterThan(0)) rows.push({ ...base, bucket: 'SALEABLE', qty: recd, freeQty: free });
        if (dmg.greaterThan(0)) rows.push({ ...base, bucket: 'DAMAGED', qty: dmg, freeQty: ZERO });
        allocs.set(l.lineNo, rows);
      }
      void out;
    });
    if (allocProblems.length) purRefuseMany(allocProblems[0].message, allocProblems);

    return { supplier, interState, taxMode, items, taxes, charges, calc, allocs, grn };
  }

  /**
   * The GRN lines the bill names, checked and taken over (R4): unit, received,
   * damaged and free come from the GRN and overwrite what the client sent. A
   * GRN line is billed whole, by one bill, at the GRN's branch (R2).
   */
  private async loadGrnLines(tx: Tx, dto: SavePurchaseInvoiceDto, problems: { field: string; code: string; message: string }[]) {
    const h = dto.header;
    const out = new Map<number, GrnFacts>();
    const named = dto.lines.filter((l) => l.grnItemId);
    if (!named.length) return out;
    const rows = await this.grnFacts(tx, named.map((l) => l.grnItemId!), h.piId ?? null);
    const byId = new Map(rows.map((r) => [r.gri_id, r]));
    const seen = new Set<string>();
    dto.lines.forEach((l, i) => {
      if (!l.grnItemId) return;
      const g = byId.get(l.grnItemId);
      const field = `lines.${i}.grnItemId`;
      const say = (code: string, message: string) => problems.push({ field, code, message: `Line ${l.lineNo}: ${message}` });
      if (!g) return say(PUR.NOT_FOUND, 'its GRN line was not found');
      if (seen.has(g.gri_id)) return say(PUR.GRN_LINE_BILLED, `${g.grn_refno} line ${g.gri_line_no} is on this bill twice`);
      seen.add(g.gri_id);
      if (g.grn_status !== 'POSTED') return say(PUR.NOT_POSTED, `${g.grn_refno} is ${g.grn_status} — only a posted GRN is billed`);
      if (g.grn_supplier_id !== h.supplierId) return say(PUR.GRN_MISMATCH, `${g.grn_refno} is another supplier's GRN`);
      if (g.grn_company_id !== h.companyId || g.grn_branch_id !== h.branchId) return say(PUR.GRN_MISMATCH, `${g.grn_refno} was received at another branch — bill it there`);
      if (g.billed_in) return say(PUR.GRN_LINE_BILLED, `${g.grn_refno} line ${g.gri_line_no} is already billed in ${g.billed_in}`);
      if (g.draft_return) return say(PUR.GRN_NOT_BUILT, `${g.grn_refno} line ${g.gri_line_no} has the draft return ${g.draft_return} — post or cancel it first`);
      if (Number(g.short_touched) > 0) return say(PUR.GRN_NOT_BUILT, `${g.grn_refno} line ${g.gri_line_no}: its challan shortage is already received or closed — cancel that first, bill the GRN, then receive the shortage against the bill`);
      if (l.itemId !== g.gri_item_id || l.uomId !== g.gri_uom_id) return say(PUR.GRN_MISMATCH, `the item and unit must be the GRN line's (${g.grn_refno} line ${g.gri_line_no})`);
      const kept = g.gri_received_qty.plus(g.gri_damaged_qty).minus(g.returned_qty);
      if (D(l.billedQty).lessThan(kept)) {
        return say(PUR.QTY_INVALID, `billed ${D(l.billedQty).toString()} is less than the ${kept.toString()} kept from ${g.grn_refno}${g.returned_qty.isZero() ? '' : ` (${g.returned_qty.toString()} went back on a GRN return)`} — bill it all (return the excess against the bill)`);
      }
      // R18: billed beyond what was kept, up to what went back = rejected (its debit note is written at post);
      // the calculation sees it as having come in, so its GST is claimed here and reversed by that note
      const rejected = Prisma.Decimal.min(g.returned_qty, D(l.billedQty).minus(kept));
      g.rejected_billed = rejected;
      let notBilledBack = g.returned_qty.minus(rejected);
      const recd = Prisma.Decimal.max(0, g.gri_received_qty.minus(notBilledBack));
      notBilledBack = notBilledBack.minus(g.gri_received_qty.minus(recd));
      l.receivedQty = Number(recd);
      l.damagedQty = Number(g.gri_damaged_qty.minus(notBilledBack));
      l.freeQty = Number(Prisma.Decimal.max(0, g.gri_free_qty.minus(g.returned_free)));
      l.allocs = undefined;
      out.set(l.lineNo, g);
    });
    return out;
  }

  private async grnFacts(db: Tx, griIds: string[], exceptPiId: string | null) {
    return db.$queryRaw<GrnFacts[]>`
      SELECT gri.gri_id, gri.gri_acc_year, gri.gri_line_no, gri.gri_item_id, gri.gri_uom_id,
             gri.gri_received_qty, gri.gri_damaged_qty, gri.gri_free_qty, gri.gri_challan_qty, gri.gri_to_base_factor, gri.gri_value, gri.gri_offbill_share,
             g.grn_id, g.grn_refno, g.grn_doc_date, g.grn_status, g.grn_company_id, g.grn_branch_id, g.grn_supplier_id,
             (SELECT p.pi_refno FROM purchase.pur_invoice_item x
                JOIN purchase.pur_invoice p ON p.pi_id = x.pii_pi_id AND p.pi_acc_year = x.pii_acc_year
               WHERE x.pii_src_doc_type = 'GRN' AND x.pii_src_item_id = gri.gri_id AND NOT x.pii_is_deleted
                 AND NOT p.pi_is_deleted AND p.pi_status <> 'CANCELLED'
                 AND (${exceptPiId}::uuid IS NULL OR p.pi_id <> ${exceptPiId}::uuid)
               LIMIT 1) AS billed_in,
             (SELECT pr.pr_refno FROM purchase.pur_return_item ri
                JOIN purchase.pur_return pr ON pr.pr_id = ri.pri_pr_id AND pr.pr_acc_year = ri.pri_acc_year
               WHERE ri.pri_src_doc_type = 'GRN' AND ri.pri_src_item_id = gri.gri_id AND NOT ri.pri_is_deleted
                 AND pr.pr_status = 'DRAFT' AND NOT pr.pr_is_deleted
               LIMIT 1) AS draft_return,
             COALESCE(ret.qty, 0) AS returned_qty, COALESCE(ret.free, 0) AS returned_free, COALESCE(ret.value, 0) AS returned_value,
             (SELECT count(*) FROM purchase.pur_shortage s
               WHERE s.psh_src_doc_type = 'GRN' AND s.psh_src_item_id = gri.gri_id AND NOT s.psh_is_deleted
                 AND (EXISTS (SELECT 1 FROM purchase.pur_shortage_receipt_item i
                                JOIN purchase.pur_shortage_receipt r ON r.psr_id = i.psri_psr_id AND r.psr_acc_year = i.psri_acc_year
                               WHERE i.psri_shortage_id = s.psh_id AND NOT i.psri_is_deleted AND NOT r.psr_is_deleted AND r.psr_status <> 'CANCELLED')
                   OR COALESCE((SELECT SUM(c.psc_qty_base) FROM purchase.pur_shortage_close c
                                 WHERE c.psc_shortage_id = s.psh_id AND NOT c.psc_is_deleted), 0) <> 0)) AS short_touched
        FROM purchase.pur_grn_item gri
        JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
        LEFT JOIN LATERAL (
          SELECT SUM(ri.pri_qty) AS qty, SUM(ri.pri_free_qty) AS free, SUM(ri.pri_taxable_amt) AS value
            FROM purchase.pur_return_item ri
            JOIN purchase.pur_return pr ON pr.pr_id = ri.pri_pr_id AND pr.pr_acc_year = ri.pri_acc_year
           WHERE ri.pri_src_doc_type = 'GRN' AND ri.pri_src_item_id = gri.gri_id AND NOT ri.pri_is_deleted
             AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted) ret ON true
       WHERE gri.gri_id = ANY(${griIds}::uuid[]) AND NOT gri.gri_is_deleted AND NOT g.grn_is_deleted`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  grn-lines — what a supplier's posted GRNs still have to be billed
  // ═══════════════════════════════════════════════════════════════════════
  async grnLines(q: GrnLinesQueryDto) {
    const ids = await this.prisma.$queryRaw<{ gri_id: string }[]>`
      SELECT gri.gri_id FROM purchase.pur_grn_item gri
        JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
       WHERE g.grn_company_id = ${q.companyId}::uuid AND g.grn_branch_id = ${q.branchId}::uuid AND g.grn_supplier_id = ${q.supplierId}::uuid
         AND g.grn_status = 'POSTED' AND NOT g.grn_is_deleted AND NOT gri.gri_is_deleted`;
    if (!ids.length) return [];
    const facts = (await this.grnFacts(this.prisma as unknown as Tx, ids.map((r) => r.gri_id), q.piId ?? null)).filter((f) => !f.billed_in);
    if (!facts.length) return [];
    const extra = await this.prisma.$queryRaw<{ gri_id: string; gri_provisional_rate: Prisma.Decimal; gri_mrp: Prisma.Decimal | null; gri_sell_a: Prisma.Decimal | null;
                                                 gri_src_doc_refno: string | null; grn_challan_no: string | null; grn_supplier_inv_no: string | null;
                                                 item_name: string; unit_name: string; item_default_tax_id: string | null; poi_disc_pct: Prisma.Decimal | null; poi_rate: Prisma.Decimal | null; poi_tax_id: string | null }[]>`
      SELECT gri.gri_id, gri.gri_provisional_rate, gri.gri_mrp, gri.gri_sell_a, po.po_refno AS gri_src_doc_refno, g.grn_challan_no, g.grn_supplier_inv_no,
             im.item_name_en AS item_name, u.unit_name, im.item_default_tax_id,
             poi.poi_disc_pct, poi.poi_rate, poi.poi_tax_id
        FROM purchase.pur_grn_item gri
        JOIN purchase.pur_grn g ON g.grn_id = gri.gri_grn_id AND g.grn_acc_year = gri.gri_acc_year
        JOIN inventory.item_master im ON im.item_id = gri.gri_item_id
        JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = gri.gri_uom_id
        JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        LEFT JOIN purchase.pur_order_item poi ON gri.gri_src_doc_type = 'PURCHASE_ORDER' AND poi.poi_id = gri.gri_src_item_id
        LEFT JOIN purchase.pur_order po ON po.po_id = poi.poi_po_id AND po.po_acc_year = poi.poi_acc_year
       WHERE gri.gri_id = ANY(${facts.map((f) => f.gri_id)}::uuid[])`;
    const ex = new Map(extra.map((e) => [e.gri_id, e]));
    return jsonSafe(
      facts
        .sort((a, b) => a.grn_doc_date.getTime() - b.grn_doc_date.getTime() || a.grn_refno.localeCompare(b.grn_refno) || a.gri_line_no - b.gri_line_no)
        .map((f) => {
          const e = ex.get(f.gri_id);
          const blocked = f.draft_return ? `Draft return ${f.draft_return} against it` : Number(f.short_touched) > 0 ? 'Challan shortage already received / closed' : null;
          return {
            grnItemId: f.gri_id, grnItemAccYear: f.gri_acc_year, grnId: f.grn_id, grnRefno: f.grn_refno, grnDate: isoDate(f.grn_doc_date), lineNo: f.gri_line_no,
            challanNo: e?.grn_challan_no ?? null, supplierInvNo: e?.grn_supplier_inv_no ?? null, poRefno: e?.gri_src_doc_refno ?? null,
            itemId: f.gri_item_id, itemName: e?.item_name ?? null, uomId: f.gri_uom_id, unitName: e?.unit_name ?? null,
            challanQty: f.gri_challan_qty, receivedQty: f.gri_received_qty, damagedQty: f.gri_damaged_qty, freeQty: f.gri_free_qty,
            returnedQty: f.returned_qty, returnedFreeQty: f.returned_free,
            provisionalRate: e?.gri_provisional_rate ?? null, provisionalValue: f.gri_value,
            poRate: e?.poi_rate ?? null, poDiscPct: e?.poi_disc_pct ?? null, taxId: e?.poi_tax_id ?? e?.item_default_tax_id ?? null,
            mrp: e?.gri_mrp ?? null, sellA: e?.gri_sell_a ?? null, blocked,
          };
        }),
    );
  }

  private calcPayload(p: Prepared, dto: SavePurchaseInvoiceDto) {
    const c = p.calc;
    return {
      interState: p.interState,
      supplierTaxMode: p.taxMode,
      lines: c.lines.map((l, i) => ({ lineNo: dto.lines[i].lineNo, ...decimals(l), rejectedQty: (p.grn.get(dto.lines[i].lineNo)?.rejected_billed ?? ZERO).toString() })),
      charges: c.charges.map((ch, i) => ({ chgId: dto.charges![i].chgId, ...decimals(ch), payees: ch.payees.map((x) => ({ partyId: x.partyId, amount: x.amount.toFixed(2) })) })),
      totals: decimals({ ...c, lines: undefined, charges: undefined }),
      invoiceAmountPrinted: dto.header.invoiceAmountPrinted,
      difference: D(dto.header.invoiceAmountPrinted).minus(c.netPayable).toFixed(2),
    };
  }

  private async assertNotDuplicate(tx: Tx, dto: SavePurchaseInvoiceDto) {
    const h = dto.header;
    // R1 / P17: company-wide, every branch; not a unique index (offline branches)
    const dup = await tx.$queryRaw<{ pi_refno: string; br: string | null }[]>`
      SELECT pi.pi_refno, b.br_name AS br FROM purchase.pur_invoice pi
        LEFT JOIN public.branch_master b ON b.br_id = pi.pi_branch_id
       WHERE pi.pi_company_id = ${h.companyId}::uuid AND pi.pi_supplier_id = ${h.supplierId}::uuid
         AND upper(trim(pi.pi_supplier_inv_no)) = upper(trim(${h.supplierInvNo}))
         AND pi.pi_acc_year = ${h.accYear}::bpchar AND pi.pi_is_deleted = false AND pi.pi_status <> 'CANCELLED'
         AND (${h.piId ?? null}::uuid IS NULL OR pi.pi_id <> ${h.piId ?? null}::uuid)
       LIMIT 1`;
    if (dup.length) {
      purConflict(`Supplier invoice ${h.supplierInvNo} is already entered as ${dup[0].pi_refno}${dup[0].br ? ` (${dup[0].br})` : ''}.`, PUR.DUPLICATE_SUPPLIER_INVOICE, 'header.supplierInvNo');
    }
  }

  private assertPrintedAmount(p: Prepared, dto: SavePurchaseInvoiceDto) {
    const diff = D(dto.header.invoiceAmountPrinted).minus(p.calc.netPayable);
    if (!diff.isZero()) {
      purRefuse(`Invoice amount ${D(dto.header.invoiceAmountPrinted).toFixed(2)} does not match the net payable ${p.calc.netPayable.toFixed(2)} (difference ${diff.toFixed(2)}). Check the lines, charges and round off.`,
        PUR.INVOICE_AMOUNT_MISMATCH, 'header.invoiceAmountPrinted');
    }
  }

  private async allocateNumber(tx: Tx, companyId: string, branchId: string, accYear: string, deviceId: string) {
    const devCode = await resolveDeviceCode(tx, deviceId);
    const lockKey = ['PUR', companyId, branchId, accYear, deviceId].join('|');
    await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('purchase_doc_no'), hashtext(${lockKey})))::int AS locked`;
    const [r] = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT COALESCE(MAX(pi_slno), 0) + 1 AS n FROM purchase.pur_invoice
       WHERE pi_company_id = ${companyId}::uuid AND pi_branch_id = ${branchId}::uuid AND pi_acc_year = ${accYear}::bpchar AND pi_device_id = ${deviceId}::uuid`;
    const slno = BigInt(r.n);
    return { slno, refno: ['PUR', accYear.trim(), devCode, slno.toString().padStart(5, '0')].join('/') };
  }

  private async writeDocument(tx: Tx, dto: SavePurchaseInvoiceDto, p: Prepared, id: string | null, slno: bigint, refno: string, actor: string): Promise<string> {
    const h = dto.header;
    const c = p.calc;
    const creditDays = h.creditDays ?? p.supplier.sup_credit_days ?? 0;
    const due = addDays(h.supplierInvDate, creditDays);
    const data = {
      piCompanyId: h.companyId, piBranchId: h.branchId, piAccYear: h.accYear, piDeviceId: h.deviceId, piSessionId: h.sessionId ?? null,
      piSlno: slno, piRefno: refno, piDocDate: new Date(`${h.docDate}T00:00:00Z`), piStatus: 'DRAFT',
      piSupplierId: h.supplierId, piSupplierGstin: p.supplier.sup_gst_no, piSupplierGstType: p.taxMode,
      piSupplierInvNo: h.supplierInvNo.trim(), piSupplierInvDate: new Date(`${h.supplierInvDate}T00:00:00Z`),
      piGoodsReceivedOn: h.goodsReceivedOn ? new Date(`${h.goodsReceivedOn}T00:00:00Z`)
        : p.grn.size ? new Date(Math.min(...[...p.grn.values()].map((g) => g.grn_doc_date.getTime()))) : new Date(`${h.docDate}T00:00:00Z`),
      piSourceKind: p.grn.size ? 'GRN' : 'DIRECT', piGodownId: h.godownId, piInvoiceAmountPrinted: D(h.invoiceAmountPrinted), piMode: h.mode ?? 'CREDIT',
      piCreditDays: creditDays, piDueDate: new Date(`${due}T00:00:00Z`), piIsReverseCharge: false,
      piEwbNo: h.ewbNo ?? null, piEwbDate: h.ewbDate ? new Date(`${h.ewbDate}T00:00:00Z`) : null, piIrn: h.irn ?? null, piAckNo: h.ackNo ?? null,
      piGrossAmt: c.gross, piDiscAmt: c.discount, piTaxableAmt: c.taxable, piCgstAmt: c.cgst, piSgstAmt: c.sgst, piIgstAmt: c.igst, piCessAmt: c.cess,
      piChargesOnBill: c.chargesOnBill, piTcsAmt: c.tcs, piRoundOff: c.roundOff, piNetPayable: c.netPayable, piOffbillCharges: c.offbillCharges,
      piShortValue: c.shortValue, piItcEligibleAmt: c.itcEligible, piItcPendingAmt: c.itcPending, piItcIneligibleAmt: c.itcIneligible,
      piPolicy: { invAmountCheck: 'REFUSE', roundOffStep: 1, priceUpdate: 'OFF' } as Prisma.InputJsonValue,
      piRemarks: h.remarks ?? null,
    };
    let piId: string;
    if (id) {
      await tx.purInvoice.update({ where: { piId_piAccYear: { piId: id, piAccYear: h.accYear } }, data: { ...data, piModifiedBy: actor, piModifiedOn: new Date(), piRevisionNo: { increment: 1 } } });
      piId = id;
    } else {
      const row = await tx.purInvoice.create({ data: { ...data, piCreatedBy: actor }, select: { piId: true } });
      piId = row.piId;
    }

    for (let i = 0; i < dto.lines.length; i++) {
      const l: PurchaseInvoiceLineDto = dto.lines[i];
      const o = c.lines[i];
      const it = p.items.get(l.uomId)!;
      const g = p.grn.get(l.lineNo);
      const row = await tx.purInvoiceItem.create({
        data: {
          piiPiId: piId, piiCompanyId: h.companyId, piiBranchId: h.branchId, piiAccYear: h.accYear, piiLineNo: l.lineNo,
          ...(g ? { piiSrcDocType: 'GRN', piiSrcDocId: g.grn_id, piiSrcDocYear: g.gri_acc_year, piiSrcItemId: g.gri_id, piiSrcDocLineNo: g.gri_line_no, piiSrcDocRefno: g.grn_refno,
                    piiRejectedAtGrnQty: g.rejected_billed ?? ZERO } : {}),
          piiItemId: l.itemId, piiUomId: l.uomId, piiBaseUomId: it.base_iuc_id, piiToBaseFactor: it.iuc_to_base_factor,
          piiHsnCode: it.item_hsn_code, piiWeight: l.weight ?? null,
          piiBilledQty: D(l.billedQty), piiReceivedQty: D(l.billedQty).minus(D(l.damagedQty)).minus(o.shortQty), piiDamagedQty: D(l.damagedQty),
          piiShortQty: o.pendingShortQty, piiAbsorbedShortQty: o.absorbedShortQty, piiFreeQty: D(l.freeQty),
          piiRate: D(l.rate), piiDiscPct: D(l.discPct), piiDiscPerQty: D(l.discPerQty), piiDiscAmt: o.discAmt,
          piiSchPct: D(l.schPct), piiSchPerQty: D(l.schPerQty), piiSchAmt: o.schAmt, piiExtraDiscAmt: o.extraDiscAmt,
          piiChrgBeforeTax: o.chrgBeforeTax, piiChrgAfterTax: o.chrgAfterTax,
          piiGrossAmt: o.gross, piiTaxableAmt: o.taxable, piiTaxId: l.taxId ?? null, piiGstPct: o.gstPct,
          piiCgstAmt: o.cgst, piiSgstAmt: o.sgst, piiIgstAmt: o.igst, piiCessPct: D(l.cessPct), piiCessPerUnit: D(l.cessPerUnit), piiCessAmt: o.cess,
          piiTotalAmt: o.total, piiItcEligibleAmt: o.itcEligible, piiItcPendingAmt: o.itcPending, piiItcIneligibleAmt: o.itcIneligible,
          piiItcClass: o.itcClass, piiLandedCostWot: o.landedCostWot, piiMarkupAPct: l.markupAPct ?? null,
          piiSellA: l.sellA ?? null, piiSellB: l.sellB ?? null, piiSellC: l.sellC ?? null, piiSellD: l.sellD ?? null, piiMrp: l.mrp ?? null,
          piiPriceUpdateResult: 'OFF', piiRemarks: l.remarks ?? null, piiCreatedBy: actor,
        },
        select: { piiId: true },
      });
      const rows = p.allocs.get(l.lineNo) ?? [];
      let rowNo = 0;
      for (const a of rows) {
        await tx.purItemAlloc.create({
          data: {
            piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC_TYPE, piaDocId: piId, piaLineId: row.piiId,
            piaRowNo: ++rowNo, piaGodownId: a.godownId, piaBucket: a.bucket, piaBatchNo: a.batchNo,
            piaMfgDate: a.mfgDate ? new Date(`${a.mfgDate}T00:00:00Z`) : null, piaExpiryDate: a.expiryDate ? new Date(`${a.expiryDate}T00:00:00Z`) : null,
            piaMrp: a.mrp, piaSalePrice: a.salePrice, piaSizeId: a.sizeId, piaColourId: a.colourId, piaModel: a.model,
            piaSerialNo: a.serialNo, piaWarrantyTo: a.warrantyTo ? new Date(`${a.warrantyTo}T00:00:00Z`) : null,
            piaQty: a.qty, piaFreeQty: a.freeQty, piaCreatedBy: actor,
          },
        });
      }
    }

    // charges: one detail row per charge, or per payee for an off-bill charge
    let slnoC = 0;
    for (let i = 0; i < (dto.charges ?? []).length; i++) {
      const ch = dto.charges![i];
      const m = p.charges.find((x) => x.chg_id === ch.chgId)!;
      const out = c.charges[i];
      const rows = out.payees.length ? out.payees.map((x) => ({ partyId: x.partyId, amount: x.amount })) : [{ partyId: null as string | null, amount: out.amount }];
      for (const r of rows) {
        slnoC++;
        await tx.$executeRaw`
          INSERT INTO public.txn_charge_detail (
            cd_doc_type, cd_doc_id, cd_slno, cd_comp_id, cd_branch_id, cd_acc_year, cd_voucher_no,
            cd_chg_id, cd_chg_name, cd_role, cd_method, cd_type, cd_apply_on, cd_ledger_code,
            cd_landing_cost, cd_cost_alloc, cd_before_tax, cd_tax_apl, cd_sep_post,
            cd_rate, cd_amount, cd_tax_perc, cd_cgst_amt, cd_sgst_amt, cd_igst_amt, cd_net_amt,
            cd_on_bill, cd_party_id, cd_created_by)
          VALUES (${DOC_TYPE}, ${piId}::uuid, ${slnoC}::int, ${h.companyId}::uuid, ${h.branchId}::uuid, ${h.accYear}::bpchar, ${slno}::bigint,
            ${m.chg_id}::uuid, ${m.chg_name}, ${m.chg_role}, ${m.chg_method}, ${m.chg_type}, ${m.chg_cost_alloc ?? 'VALUE'}, ${m.chg_ledger_code}::uuid,
            ${m.chg_on_bill ? m.chg_landing_cost : true}, ${m.chg_cost_alloc}, ${m.chg_before_tax}, ${m.chg_tax_apl}, ${!m.chg_landing_cost},
            ${ch.rate ?? m.chg_default_rate ?? 0}::numeric, ${r.amount.abs()}::numeric, ${m.tax_rate_perc ?? 0}::numeric,
            ${rows.length === 1 ? out.cgst : ZERO}::numeric, ${rows.length === 1 ? out.sgst : ZERO}::numeric, ${rows.length === 1 ? out.igst : ZERO}::numeric,
            ${r.amount.abs()}::numeric, ${m.chg_on_bill}, ${r.partyId}::uuid, ${actor})`;
      }
    }
    return piId;
  }

  private stockRules(): StockVoucherTypeRules {
    return {
      voucherType: 'RECEIPT', typeCode: DOC_TYPE, displayName: 'Purchase', requiresToGodown: true, requiresFromGodown: false,
      isInward: true, ledgerTxnTypes: ['PURCHASE'], quantityMode: 'QTY', defaultRateSource: 'MANUAL', allowsCount: false,
      allowsToBranch: false, postShape: 'SIMPLE', auditScreenName: 'Purchase', statusDocType: TxnStatusDocType.PURCHASE_BILL,
    } as StockVoucherTypeRules;
  }

  private async postInTx(tx: Tx, piId: string, accYear: string, actor: string) {
    const pi = await tx.purInvoice.findFirst({ where: { piId, piAccYear: accYear, piIsDeleted: false } });
    if (!pi) purNotFound(`Purchase invoice ${piId} not found`);
    if (pi.piStatus !== 'DRAFT') purConflict(`${pi.piRefno} is ${pi.piStatus} — only a draft can be posted.`, PUR.NOT_DRAFT, 'piId');
    const diff = pi.piInvoiceAmountPrinted.minus(pi.piNetPayable);
    if (!diff.isZero()) {
      purRefuse(`Invoice amount ${pi.piInvoiceAmountPrinted.toFixed(2)} does not match the net payable ${pi.piNetPayable.toFixed(2)} (difference ${diff.toFixed(2)}).`, PUR.INVOICE_AMOUNT_MISMATCH, 'header.invoiceAmountPrinted');
    }
    const lines = await tx.purInvoiceItem.findMany({ where: { piiPiId: piId, piiAccYear: accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } });
    const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC_TYPE, piaDocId: piId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } });
    const postedOn = new Date();
    const docDate = isoDate(pi.piDocDate);

    // ── 1 · stock: the shadow RECEIPT ───────────────────────────────────
    const stockAllocs = allocs.filter((a) => a.piaQty.plus(a.piaFreeQty).greaterThan(0));
    if (stockAllocs.length) {
      const rules = this.stockRules();
      const slno = await nextStockVoucherSlno(tx, { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, voucherType: 'RECEIPT', deviceId: pi.piDeviceId });
      const totalQty = stockAllocs.reduce((s, a) => s.plus(a.piaQty).plus(a.piaFreeQty), ZERO);
      const [hdr] = await tx.$queryRaw<{ svh_id: string }[]>`
        INSERT INTO stock.stock_voucher (
          svh_company_id, svh_branch_id, svh_acc_year, svh_device_id, svh_session_id,
          svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
          svh_to_godown_id, svh_supplier_id, svh_party_ref,
          svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
          svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by)
        VALUES (${pi.piCompanyId}::uuid, ${pi.piBranchId}::uuid, ${accYear}::bpchar, ${pi.piDeviceId}::uuid, ${pi.piSessionId}::uuid,
          'RECEIPT', ${slno}::bigint, ${`${DOC_TYPE}/${pi.piRefno}/r${pi.piRevisionNo}`}, ${pi.piSupplierInvNo}, ${docDate}::date, ${postedOn},
          ${pi.piGodownId}::uuid, ${pi.piSupplierId}::uuid, ${pi.piSupplierId},
          ${SRC_MODULE}, ${DOC_TYPE}, ${piId}::uuid, ${accYear}::bpchar,
          ${stockAllocs.length}::int, ${totalQty}::numeric, 'DRAFT', 'MANUAL', ${`Purchase ${pi.piRefno} · ${pi.piSupplierInvNo}`}, ${postedOn}, ${actor})
        RETURNING svh_id`;
      const lineById = new Map(lines.map((l) => [l.piiId, l]));
      // textile: a blank batch on a batch-tracked item takes the server's number; its size / colour / model are kept against it
      const textileRows = stockAllocs.map((a) => ({ itemId: lineById.get(a.piaLineId)!.piiItemId, batchNo: a.piaBatchNo, sizeId: a.piaSizeId, colourId: a.piaColourId, model: a.piaModel }));
      const textile = await numberTextileBatches(tx, { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, docDate }, textileRows);
      stockAllocs.forEach((a, k) => { a.piaBatchNo = textile.batchNos[k]; textileRows[k].batchNo = textile.batchNos[k]; });
      const values = stockAllocs.map((a, k) => {
        const l = lineById.get(a.piaLineId)!;
        const f = l.piiToBaseFactor;
        return Prisma.sql`(
          ${hdr.svh_id}::uuid, ${pi.piCompanyId}::uuid, ${pi.piBranchId}::uuid, ${accYear}::bpchar, ${k + 1}::int, 1,
          ${l.piiItemId}::uuid, ${l.piiUomId}::uuid, ${l.piiBaseUomId}::uuid, ${f}::numeric,
          ${a.piaGodownId}::uuid, ${a.piaBucket}, ${a.piaBatchNo}, ${a.piaMfgDate}::date, ${a.piaExpiryDate}::date,
          ${a.piaMrp}::numeric, ${a.piaSalePrice}::numeric, ${a.piaSerialNo}, ${pi.piSupplierId}::uuid,
          ${a.piaQty}::numeric, ${a.piaQty.times(f)}::numeric, ${a.piaFreeQty}::numeric, ${a.piaFreeQty.times(f)}::numeric,
          ${l.piiLandedCostWot}::numeric, ${l.piiLandedCostWot}::numeric, ${l.piiLandedCostWot}::numeric, 0::numeric,
          ${postedOn}, ${actor})`;
      });
      await tx.$executeRaw`
        INSERT INTO stock.stock_voucher_item (
          svi_voucher_id, svi_company_id, svi_branch_id, svi_acc_year, svi_line_no, svi_split_no,
          svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
          svi_godown_id, svi_bucket, svi_batch_no, svi_mfg_date, svi_expiry_date,
          svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
          svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
          svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc,
          svi_created_on, svi_created_by) VALUES ${Prisma.join(values)}`;
      await writeTextileDetails(tx, { companyId: pi.piCompanyId, accYear, svhId: hdr.svh_id, actor }, textileRows, textile.numbered);
      await this.stockPosting.post(
        tx,
        new StockVoucherSource({ svhId: hdr.svh_id, accYear, companyId: pi.piCompanyId, branchId: pi.piBranchId, rules }),
        { actor, postedOn, ledgerSource: { srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcRefno: pi.piRefno, partyId: pi.piSupplierId } },
      );
      const [moved] = await tx.$queryRaw<{ qty: Prisma.Decimal | null }[]>`
        SELECT SUM(sml_qty + sml_free_qty) AS qty FROM stock.stock_ledger
         WHERE sml_src_doc_id = ${hdr.svh_id}::uuid AND sml_acc_year = ${accYear}::bpchar AND sml_is_reversal = false AND sml_is_deleted = false`;
      if (!D(moved?.qty).toDecimalPlaces(4).equals(totalQty.toDecimalPlaces(4))) {
        throw new Error(`${PUR.STOCK_QTY_MISMATCH}: ${pi.piRefno} moved ${D(moved?.qty).toString()} against ${totalQty.toString()}`);
      }
      const lots = await tx.$queryRaw<{ svi_line_no: number; svi_lot_id: string | null; svi_id: string }[]>`
        SELECT svi_line_no, svi_lot_id, svi_id FROM stock.stock_voucher_item WHERE svi_voucher_id = ${hdr.svh_id}::uuid AND svi_acc_year = ${accYear}::bpchar`;
      for (const r of lots) {
        const a = stockAllocs[r.svi_line_no - 1];
        if (a) await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaLotId: r.svi_lot_id, piaSviId: r.svi_id, piaSviAccYear: accYear, piaBatchNo: a.piaBatchNo } });
      }
    }

    // ── 1b · lines billed off a GRN: re-check under the post, revalue what is still on hand (R2 / P13) ──
    const grnLines = lines.filter((l) => l.piiSrcDocType === 'GRN' && l.piiSrcItemId);
    let grniDr = ZERO, variance = ZERO;
    const grnOf = new Map<string, GrnFacts>();
    if (grnLines.length) {
      for (const g of await this.grnFacts(tx, grnLines.map((l) => l.piiSrcItemId!), piId)) grnOf.set(g.gri_id, g);
      const revLines: CostRevaluationLine[] = [];
      for (const l of grnLines) {
        const g = grnOf.get(l.piiSrcItemId!);
        if (!g || g.grn_status !== 'POSTED') purConflict(`Line ${l.piiLineNo}: its GRN is no longer posted.`, PUR.NOT_POSTED, 'lines');
        if (g.billed_in) purConflict(`Line ${l.piiLineNo}: ${g.grn_refno} line ${g.gri_line_no} is already billed in ${g.billed_in}.`, PUR.GRN_LINE_BILLED, 'lines');
        if (g.draft_return) purConflict(`Line ${l.piiLineNo}: ${g.grn_refno} has the draft return ${g.draft_return} — post or cancel it first.`, PUR.GRN_NOT_BUILT, 'lines');
        if (Number(g.short_touched) > 0) purConflict(`Line ${l.piiLineNo}: the challan shortage of ${g.grn_refno} was received / closed meanwhile.`, PUR.GRN_NOT_BUILT, 'lines');
        // R18: the rejected qty the draft was saved with must still be what the GRN returns say
        const kept = g.gri_received_qty.plus(g.gri_damaged_qty).minus(g.returned_qty);
        const rejected = Prisma.Decimal.min(g.returned_qty, Prisma.Decimal.max(0, l.piiBilledQty.minus(kept)));
        if (l.piiBilledQty.lessThan(kept) || !rejected.equals(l.piiRejectedAtGrnQty)) {
          purConflict(`Line ${l.piiLineNo}: the returns against ${g.grn_refno} changed since this draft was saved — save it again.`, PUR.GRN_NOT_BUILT, 'lines');
        }
        const f = g.gri_to_base_factor;
        const keptBase = kept.plus(Prisma.Decimal.max(0, g.gri_free_qty.minus(g.returned_free))).times(f);
        const grniOpen = g.gri_value.minus(g.returned_value);
        const landedKept = l.piiLandedCostWot.times(keptBase).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        grniDr = grniDr.plus(grniOpen);
        variance = variance.plus(landedKept.minus(grniOpen));
        if (rejected.greaterThan(0)) {
          // billed but rejected: off GRNI at the bill's value (its debit note puts the same back), the landed rest → variance
          const dn = this.rejectedMoney(l);
          grniDr = grniDr.plus(dn.taxable);
          variance = variance.plus(l.piiLandedCostWot.times(rejected.times(f)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).minus(dn.taxable));
        }
        revLines.push({ lineId: l.piiId, itemId: l.piiItemId, inBaseQty: keptBase, delta: landedKept.minus(grniOpen), lots: [] });
      }
      const gAllocs = await tx.purItemAlloc.findMany({ where: { piaDocType: 'GRN', piaLineId: { in: grnLines.map((l) => l.piiSrcItemId!) }, piaIsDeleted: false } });
      // what each lot gave back on posted GRN returns (base qty), so a lot's share is what it kept
      const back = await tx.$queryRaw<{ gri_id: string; lot_id: string; qty: Prisma.Decimal }[]>`
        SELECT ri.pri_src_item_id AS gri_id, a.pia_lot_id AS lot_id, SUM((a.pia_qty + a.pia_free_qty) * ri.pri_to_base_factor) AS qty
          FROM purchase.pur_return_item ri
          JOIN purchase.pur_return pr ON pr.pr_id = ri.pri_pr_id AND pr.pr_acc_year = ri.pri_acc_year
          JOIN purchase.pur_item_alloc a ON a.pia_doc_type = 'PURCHASE_RETURN' AND a.pia_line_id = ri.pri_id AND a.pia_acc_year = ri.pri_acc_year AND NOT a.pia_is_deleted
         WHERE ri.pri_src_doc_type = 'GRN' AND ri.pri_src_item_id = ANY(${grnLines.map((l) => l.piiSrcItemId!)}::uuid[])
           AND NOT ri.pri_is_deleted AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted
         GROUP BY 1, 2`;
      for (const r of revLines) {
        const l = grnLines.find((x) => x.piiId === r.lineId)!;
        const g = grnOf.get(l.piiSrcItemId!)!;
        const lotIn = new Map<string, Prisma.Decimal>();
        for (const a of gAllocs.filter((x) => x.piaLineId === g.gri_id && x.piaLotId)) {
          lotIn.set(a.piaLotId!, (lotIn.get(a.piaLotId!) ?? ZERO).plus(a.piaQty.plus(a.piaFreeQty).times(g.gri_to_base_factor)));
        }
        for (const b of back.filter((x) => x.gri_id === g.gri_id)) lotIn.set(b.lot_id, (lotIn.get(b.lot_id) ?? ZERO).minus(D(b.qty)));
        r.lots = [...lotIn].filter(([, q]) => q.greaterThan(0)).map(([lotId, baseQty]) => ({ lotId, baseQty }));
      }
      const intoStock = await revalueOnHand(tx,
        { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcDocId: piId, srcAccYear: accYear,
          srcRefno: pi.piRefno, docDate, narration: `Purchase ${pi.piRefno} — bill rate over GRN rate` },
        revLines, actor, postedOn);
      for (const v of intoStock.values()) variance = variance.minus(v);
    }

    // ── 2 · books ───────────────────────────────────────────────────────
    const [vt] = await tx.$queryRaw<{ id: number }[]>`SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'PUR' AND vchr_is_active LIMIT 1`;
    if (!vt) purRefuse('Voucher type PUR is missing (migration 20261028100000).', PUR.VOUCHER_TYPE_MISSING);
    const nature = pi.piIgstAmt.greaterThan(0) ? 'INTER' : 'INTRA';
    const legs: VoucherLeg[] = [];
    const add = (leg: VoucherLeg) => { if (Math.abs(leg.amount) >= 0.005) legs.push(leg); };
    // eligible input tax, per rate and head; pending → INPUT_TAX_PENDING
    for (const l of lines) {
      const tax = l.piiCgstAmt.plus(l.piiSgstAmt).plus(l.piiIgstAmt).plus(l.piiCessAmt);
      if (tax.isZero()) continue;
      const eligShare = l.piiItcEligibleAmt.dividedBy(tax);
      const heads: [string, Prisma.Decimal][] = [['INPUT_CGST', l.piiCgstAmt], ['INPUT_SGST', l.piiSgstAmt], ['INPUT_IGST', l.piiIgstAmt], ['INPUT_CESS', l.piiCessAmt]];
      let given = ZERO;
      heads.forEach(([role, amt], k) => {
        if (amt.isZero()) return;
        const isLast = heads.slice(k + 1).every(([, a]) => a.isZero());
        const part = isLast ? l.piiItcEligibleAmt.minus(given) : amt.times(eligShare).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        given = given.plus(part);
        add({ role, drCr: 'DR', amount: num(part), taxId: l.piiTaxId, supplyNature: nature as never, roleTag: role, field: `lines.${l.piiLineNo}` });
      });
      add({ role: 'INPUT_TAX_PENDING', drCr: 'DR', amount: num(l.piiItcPendingAmt), roleTag: 'INPUT_TAX_PENDING' });
    }
    add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'DR', amount: num(pi.piShortValue), roleTag: 'SHORTAGE_RECEIVABLE' });
    // charges: non-landing on-bill charges to their own ledger; on-bill charge GST to input; off-bill to each payee (Cr)
    const chargeRows = await tx.$queryRaw<{ cd_on_bill: boolean; cd_landing_cost: boolean; cd_before_tax: boolean; cd_type: string; cd_amount: Prisma.Decimal; cd_ledger_code: string; cd_party_id: string | null; cd_cgst_amt: Prisma.Decimal; cd_sgst_amt: Prisma.Decimal; cd_igst_amt: Prisma.Decimal; cd_chg_name: string }[]>`
      SELECT cd_on_bill, cd_landing_cost, cd_before_tax, cd_type, cd_amount, cd_ledger_code, cd_party_id, cd_cgst_amt, cd_sgst_amt, cd_igst_amt, cd_chg_name
        FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC_TYPE} AND cd_doc_id = ${piId}::uuid AND cd_acc_year = ${accYear}::bpchar AND cd_is_deleted = false`;
    for (const r of chargeRows) {
      const sign = r.cd_type === 'DEDUCT' ? -1 : 1;
      if (r.cd_on_bill) {
        if (!r.cd_landing_cost) {
          const amt = sign * num(r.cd_amount);
          add({ ledgerId: r.cd_ledger_code, drCr: amt >= 0 ? 'DR' : 'CR', amount: Math.abs(amt), remarks: r.cd_chg_name });
        }
        for (const [role, v] of [['INPUT_CGST', r.cd_cgst_amt], ['INPUT_SGST', r.cd_sgst_amt], ['INPUT_IGST', r.cd_igst_amt]] as const) {
          const amt = sign * num(v);
          add({ role, drCr: amt >= 0 ? 'DR' : 'CR', amount: Math.abs(amt), supplyNature: nature as never, roleTag: role, remarks: r.cd_chg_name });
        }
      } else {
        add({ ledgerId: r.cd_party_id ?? r.cd_ledger_code, drCr: 'CR', amount: num(r.cd_amount), remarks: `${r.cd_chg_name} · ${pi.piRefno}`, docRefno: pi.piRefno });
      }
    }
    add({ role: 'TCS_RECEIVABLE', drCr: 'DR', amount: num(pi.piTcsAmt), roleTag: 'TCS_RECEIVABLE' });
    if (!pi.piRoundOff.isZero()) add({ role: 'ROUND_OFF', drCr: pi.piRoundOff.greaterThan(0) ? 'DR' : 'CR', amount: Math.abs(num(pi.piRoundOff)), roleTag: 'ROUND_OFF' });
    add({ ledgerId: pi.piSupplierId, drCr: 'CR', amount: num(pi.piNetPayable), remarks: `Bill ${pi.piSupplierInvNo}`, docRefno: pi.piRefno });
    // GRN lines: the GRN's provisional value off GRNI; the part of the difference that left stock → variance
    add({ role: 'GRNI', drCr: 'DR', amount: num(grniDr), roleTag: 'GRNI', remarks: `GRN billed · ${pi.piRefno}` });
    if (!variance.isZero()) {
      add({ role: 'PURCHASE_PRICE_VARIANCE', drCr: variance.greaterThan(0) ? 'DR' : 'CR', amount: Math.abs(num(variance)), roleTag: 'PURCHASE_PRICE_VARIANCE', remarks: `Bill vs GRN rate, stock already out · ${pi.piRefno}` });
    }
    // INVENTORY = what balances the voucher: by the calculation it IS Σ landed value of the direct lines
    // (taxable + landing charges + off-bill + ineligible GST − short value) plus the revaluation of the GRN
    // lines' stock; taking it as the balance keeps the voucher exact to the paisa however the figures rounded.
    // A bill cheaper than its GRN can make it a credit.
    const cents = (x: number) => Math.round(x * 100);
    const crTotal = legs.filter((g) => g.drCr === 'CR').reduce((s2, g) => s2 + cents(g.amount), 0);
    const drTotal = legs.filter((g) => g.drCr === 'DR').reduce((s2, g) => s2 + cents(g.amount), 0);
    const inventory = (crTotal - drTotal) / 100;
    if (inventory < 0 && !grnLines.length) throw new Error(`Purchase ${pi.piRefno}: stock value came out negative (${inventory})`);
    add({ role: 'INVENTORY', drCr: inventory >= 0 ? 'DR' : 'CR', amount: Math.abs(inventory), remarks: `Purchase ${pi.piRefno}`, roleTag: 'INVENTORY' });

    const posted = await this.vouchers.postLegs(tx, {
      header: {
        companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, voucherTypeId: vt.id, voucherDate: docDate,
        srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcDocId: piId, docLabel: 'Purchase', docRefno: pi.piRefno, docDate,
        usrRefno: pi.piSupplierInvNo, docAmount: num(pi.piNetPayable), roundOff: num(pi.piRoundOff), partyId: pi.piSupplierId,
        userId: actor, sessionId: pi.piSessionId, deviceId: pi.piDeviceId, remarks: pi.piRemarks ?? `Purchase ${pi.piSupplierInvNo}`,
        createdBy: actor, presetRefno: pi.piRefno, presetNo: pi.piSlno,
      },
      legs,
    });

    // ── 3 · bill-wise rows: the supplier and each off-bill payee ────────
    const billRow = async (partyId: string, amount: Prisma.Decimal, narration: string, dueDate: Date | null, refSuffix: string | null) => {
      if (!amount.greaterThan(0)) return;
      await tx.accBillBalance.create({
        data: {
          ablCompanyId: pi.piCompanyId, ablBranchId: pi.piBranchId, ablAccYear: accYear, ablPartyId: partyId, ablBillType: 'PURCHASE',
          ablSrcModule: SRC_MODULE, ablSrcDocType: DOC_TYPE, ablSrcDocId: piId, ablSrcAccYear: accYear,
          ablVoucherId: posted.voucherId, ablVoucherTypeId: vt.id, ablVoucherNo: pi.piSlno, ablVoucherDate: new Date(`${docDate}T00:00:00Z`),
          ablVoucherRefno: pi.piRefno, ablDocRefno: refSuffix ? `${pi.piRefno}/${refSuffix}` : pi.piRefno,
          ablDocDate: pi.piSupplierInvDate, ablDueDate: dueDate, ablCreditDays: dueDate ? (pi.piCreditDays ?? 0) : 0,
          ablDrCr: 'CR', ablBillAmount: amount, ablNarration: narration, ablCreatedBy: actor,
        },
      });
    };
    await billRow(pi.piSupplierId, pi.piNetPayable, `Purchase bill ${pi.piSupplierInvNo} (${pi.piRefno})`, pi.piDueDate, null);
    let k = 0;
    for (const r of chargeRows.filter((x) => !x.cd_on_bill)) {
      k++;
      await billRow(r.cd_party_id ?? r.cd_ledger_code, r.cd_amount, `${r.cd_chg_name} — ${pi.piRefno}`, null, `C${k}`);
    }

    // ── 4 · shortage rows ───────────────────────────────────────────────
    for (const l of lines) {
      const value = l.piiBilledQty.isZero() ? ZERO : l.piiTaxableAmt.times(l.piiShortQty).dividedBy(l.piiBilledQty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const g = l.piiSrcItemId ? grnOf.get(l.piiSrcItemId) : undefined;
      if (g) {
        // R3: the GRN's challan-short row is this line's shortage — adopt it; no short on the bill closes it
        const [row] = await tx.$queryRaw<{ psh_id: string; psh_acc_year: string }[]>`
          SELECT psh_id, psh_acc_year FROM purchase.pur_shortage
           WHERE psh_src_doc_type = 'GRN' AND psh_src_item_id = ${g.gri_id}::uuid AND psh_src_doc_year = ${g.gri_acc_year}::bpchar
             AND psh_bill_item_id IS NULL AND NOT psh_is_deleted LIMIT 1`;
        if (row) {
          const short = l.piiShortQty.greaterThan(0);
          await tx.purShortage.update({
            where: { pshId_pshAccYear: { pshId: row.psh_id, pshAccYear: row.psh_acc_year } },
            data: {
              pshBillDocId: piId, pshBillDocYear: accYear, pshBillItemId: l.piiId,
              ...(short
                ? { pshReason: 'SHORT_BILL', pshQtyBase: l.piiShortQty.times(l.piiToBaseFactor), pshValue: value, pshGstPending: l.piiItcPendingAmt, pshOriginCostRate: l.piiLandedCostWot }
                : { pshIsDeleted: true }),
              pshModifiedBy: actor, pshModifiedOn: postedOn,
            },
          });
          continue;
        }
      }
      if (!l.piiShortQty.greaterThan(0)) continue;
      await tx.purShortage.create({
        data: {
          pshCompanyId: pi.piCompanyId, pshBranchId: pi.piBranchId, pshAccYear: accYear, pshSupplierId: pi.piSupplierId, pshItemId: l.piiItemId,
          pshSrcDocType: DOC_TYPE, pshSrcDocId: piId, pshSrcDocYear: accYear, pshSrcItemId: l.piiId, pshSrcDocRefno: pi.piRefno,
          pshReason: 'SHORT_BILL', pshQtyBase: l.piiShortQty.times(l.piiToBaseFactor), pshValue: value, pshGstPending: l.piiItcPendingAmt,
          pshOriginCostRate: l.piiLandedCostWot, pshCreatedBy: actor,
        },
      });
    }

    // ── 4a · MST-02: the first bill of a (supplier, item) pair makes its supplier–item row (AUTO); an existing row is kept
    await recordSupplierItems(tx, pi.piCompanyId, pi.piSupplierId, lines.map((l) => ({ itemId: l.piiItemId, uomId: l.piiUomId, factor: l.piiToBaseFactor })), actor);

    // ── 4b · R18: the debit note for what the bill charges but the GRN sent back ──
    const rejectedLines = grnLines.filter((l) => l.piiRejectedAtGrnQty.greaterThan(0));
    if (rejectedLines.length) await this.writeRejectedDebitNote(tx, pi, rejectedLines, actor, postedOn);

    // ── 5 · status ──────────────────────────────────────────────────────
    await tx.purInvoice.update({ where: { piId_piAccYear: { piId, piAccYear: accYear } }, data: { piStatus: 'POSTED', piPostedVoucherId: posted.voucherId, piModifiedBy: actor, piModifiedOn: postedOn } });
    await appendTxnStatusLog(tx, {
      companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, srcModule: TxnStatusSrcModule.PURCHASE, srcDocType: TxnStatusDocType.PURCHASE_BILL,
      srcDocId: piId, srcDocRefno: pi.piRefno, event: TxnStatusEvent.POSTED, fromStatus: 'DRAFT', toStatus: 'POSTED', changedBy: actor, deviceId: pi.piDeviceId,
    });
  }

  /** The rejected qty's money: per billed unit of the line, each head rounded, the total their sum (as the return module's money()). */
  private rejectedMoney(l: { piiBilledQty: Prisma.Decimal; piiRejectedAtGrnQty: Prisma.Decimal; piiTaxableAmt: Prisma.Decimal;
                             piiCgstAmt: Prisma.Decimal; piiSgstAmt: Prisma.Decimal; piiIgstAmt: Prisma.Decimal; piiCessAmt: Prisma.Decimal }) {
    const per = (v: Prisma.Decimal) => (l.piiBilledQty.isZero() ? ZERO : v.times(l.piiRejectedAtGrnQty).dividedBy(l.piiBilledQty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
    const taxable = per(l.piiTaxableAmt), cgst = per(l.piiCgstAmt), sgst = per(l.piiSgstAmt), igst = per(l.piiIgstAmt), cess = per(l.piiCessAmt);
    return { taxable, cgst, sgst, igst, cess, total: taxable.plus(cgst).plus(sgst).plus(igst).plus(cess) };
  }

  /**
   * R18 — one PURCHASE_RETURN against this bill, a RETURN row per rejected line, POSTED at once:
   * Dr Supplier (bill-wise PURCHASE_RETURN) / Cr GRNI (the value the bill put on GRNI) / Cr input GST.
   * No stock voucher and no allocation rows — the goods already left on the GRN return.
   */
  private async writeRejectedDebitNote(tx: Tx, pi: { piId: string; piAccYear: string; piCompanyId: string; piBranchId: string; piDeviceId: string; piSessionId: string | null;
                                                      piRefno: string; piSupplierId: string; piDocDate: Date; piIgstAmt: Prisma.Decimal },
                                       lines: { piiId: string; piiLineNo: number; piiItemId: string; piiUomId: string; piiBaseUomId: string; piiToBaseFactor: Prisma.Decimal;
                                                piiHsnCode: string | null; piiRate: Prisma.Decimal; piiTaxId: string | null; piiGstPct: Prisma.Decimal; piiBilledQty: Prisma.Decimal;
                                                piiRejectedAtGrnQty: Prisma.Decimal; piiTaxableAmt: Prisma.Decimal; piiCgstAmt: Prisma.Decimal; piiSgstAmt: Prisma.Decimal;
                                                piiIgstAmt: Prisma.Decimal; piiCessAmt: Prisma.Decimal; piiSrcDocRefno: string | null }[],
                                       actor: string, postedOn: Date) {
    const accYear = pi.piAccYear;
    const docDate = isoDate(pi.piDocDate);
    const { slno, refno } = await allocateDocNumber(tx, 'PRN', pi.piCompanyId, pi.piBranchId, accYear, pi.piDeviceId);
    const money = lines.map((l) => ({ l, m: this.rejectedMoney(l) }));
    const total = money.reduce((s2, x) => s2.plus(x.m.total), ZERO);
    const grnRefs = [...new Set(lines.map((l) => l.piiSrcDocRefno).filter((x): x is string => !!x))].join(', ');
    const pr = await tx.purReturn.create({
      data: {
        prCompanyId: pi.piCompanyId, prBranchId: pi.piBranchId, prAccYear: accYear, prDeviceId: pi.piDeviceId, prSessionId: pi.piSessionId, prSlno: slno, prRefno: refno,
        prDocDate: pi.piDocDate, prKind: 'AGAINST_INVOICE', prSrcDocId: pi.piId, prSrcAccYear: accYear, prSupplierId: pi.piSupplierId,
        prSettlement: 'ADJUST', prOurRef: pi.piRefno, prReturnValue: total, prStatus: 'DRAFT',
        prRemarks: `Billed in ${pi.piRefno} but rejected at ${grnRefs} — debit note raised with the bill`, prCreatedBy: actor,
      },
      select: { prId: true },
    });
    for (const { l, m } of money) {
      await tx.purReturnItem.create({ data: {
        priPrId: pr.prId, priCompanyId: pi.piCompanyId, priBranchId: pi.piBranchId, priAccYear: accYear, priLineNo: l.piiLineNo,
        priItemId: l.piiItemId, priUomId: l.piiUomId, priBaseUomId: l.piiBaseUomId, priToBaseFactor: l.piiToBaseFactor, priHsnCode: l.piiHsnCode,
        priSrcDocType: DOC_TYPE, priSrcDocId: pi.piId, priSrcDocYear: accYear, priSrcItemId: l.piiId, priSrcDocLineNo: l.piiLineNo, priSrcDocRefno: pi.piRefno,
        priOutcome: 'RETURN', priQty: l.piiRejectedAtGrnQty, priFreeQty: ZERO, priRate: l.piiRate,
        priGrossAmt: m.taxable, priTaxableAmt: m.taxable, priTaxId: l.piiTaxId, priGstPct: l.piiGstPct,
        priCgstAmt: m.cgst, priSgstAmt: m.sgst, priIgstAmt: m.igst, priCessAmt: m.cess, priTotalAmt: m.total,
        priItcReversedInBooks: true, priSupplierCnStatus: 'PENDING', priRemarks: `Rejected at ${l.piiSrcDocRefno ?? 'GRN'}`, priCreatedBy: actor,
      } });
    }
    const vt = await voucherTypeId(tx, 'PRN');
    const nature = pi.piIgstAmt.greaterThan(0) ? 'INTER' : 'INTRA';
    const legs: VoucherLeg[] = [];
    const add = (leg: VoucherLeg) => { if (leg.amount >= 0.005) legs.push(leg); };
    add({ ledgerId: pi.piSupplierId, drCr: 'DR', amount: num(total), remarks: `Rejected at GRN, billed in ${pi.piRefno}`, docRefno: refno });
    add({ role: 'GRNI', drCr: 'CR', amount: num(money.reduce((s2, x) => s2.plus(x.m.taxable), ZERO)), roleTag: 'GRNI', remarks: `Rejected at ${grnRefs} · ${refno}` });
    const heads = new Map<string, { role: string; taxId: string | null; amt: Prisma.Decimal }>();
    for (const { l, m } of money) {
      for (const [role, v] of [['INPUT_CGST', m.cgst], ['INPUT_SGST', m.sgst], ['INPUT_IGST', m.igst], ['INPUT_CESS', m.cess]] as const) {
        if (v.isZero()) continue;
        const k = `${role}|${l.piiTaxId ?? ''}`;
        const cur = heads.get(k) ?? { role, taxId: l.piiTaxId, amt: ZERO };
        cur.amt = cur.amt.plus(v);
        heads.set(k, cur);
      }
    }
    for (const v of heads.values()) add({ role: v.role, drCr: 'CR', amount: num(v.amt), taxId: v.taxId, supplyNature: nature as never, roleTag: v.role });
    const posted = await this.vouchers.postLegs(tx, {
      header: { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, voucherTypeId: vt, voucherDate: docDate, srcModule: SRC_MODULE, srcDocType: 'PURCHASE_RETURN', srcDocId: pr.prId,
        docLabel: 'Purchase Return', docRefno: refno, docDate, usrRefno: null, docAmount: num(total), partyId: pi.piSupplierId,
        userId: actor, sessionId: pi.piSessionId, deviceId: pi.piDeviceId, remarks: `Rejected at ${grnRefs}, billed in ${pi.piRefno}`, createdBy: actor,
        presetRefno: refno, presetNo: slno },
      legs,
    });
    await raiseBillRow(tx, { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, partyId: pi.piSupplierId, billType: 'PURCHASE_RETURN', drCr: 'DR',
      amount: total, docType: 'PURCHASE_RETURN', docId: pr.prId, voucherId: posted.voucherId, voucherTypeId: vt, voucherNo: slno, voucherDate: docDate,
      refno, docDate: pi.piDocDate, narration: `Return ${refno}: rejected at ${grnRefs}, billed in ${pi.piRefno}`, actor });
    await tx.purReturn.update({ where: { prId_prAccYear: { prId: pr.prId, prAccYear: accYear } }, data: { prStatus: 'POSTED', prPostedVoucherId: posted.voucherId, prModifiedBy: actor, prModifiedOn: postedOn } });
    await statusLog(tx, { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, docType: TxnStatusDocType.PURCHASE_RETURN, docId: pr.prId, refno,
      event: TxnStatusEvent.POSTED, from: null, to: 'POSTED', actor, deviceId: pi.piDeviceId, remarks: `Debit note of ${pi.piRefno} (rejected at GRN)` });
  }

  /** A bill's own R18 debit notes (no allocation rows), still POSTED — cancelled with the bill. */
  private async cancelRejectedDebitNotes(tx: Tx, piId: string, refno: string, reason: string, actor: string) {
    const notes = await tx.$queryRaw<{ pr_id: string; pr_acc_year: string; pr_refno: string; pr_company_id: string; pr_branch_id: string; pr_posted_voucher_id: string | null }[]>`
      SELECT pr.pr_id, pr.pr_acc_year, pr.pr_refno, pr.pr_company_id, pr.pr_branch_id, pr.pr_posted_voucher_id
        FROM purchase.pur_return pr
       WHERE pr.pr_src_doc_id = ${piId}::uuid AND pr.pr_kind = 'AGAINST_INVOICE' AND pr.pr_status = 'POSTED' AND NOT pr.pr_is_deleted
         AND NOT EXISTS (SELECT 1 FROM purchase.pur_item_alloc a
                           JOIN purchase.pur_return_item ri ON ri.pri_id = a.pia_line_id AND ri.pri_acc_year = a.pia_acc_year
                          WHERE a.pia_doc_type = 'PURCHASE_RETURN' AND ri.pri_pr_id = pr.pr_id AND NOT a.pia_is_deleted)`;
    for (const n of notes) {
      await assertBillsUnsettled(tx, 'PURCHASE_RETURN', n.pr_id, n.pr_refno);
      if (n.pr_posted_voucher_id) await this.vouchers.reverseLegs(tx, n.pr_posted_voucher_id, n.pr_acc_year, `Return ${n.pr_refno} cancelled with ${refno}: ${reason}`, actor);
      await withdrawBillRows(tx, 'PURCHASE_RETURN', n.pr_id, actor);
      await tx.purReturn.update({ where: { prId_prAccYear: { prId: n.pr_id, prAccYear: n.pr_acc_year } }, data: { prStatus: 'CANCELLED', prModifiedBy: actor, prModifiedOn: new Date() } });
      await statusLog(tx, { companyId: n.pr_company_id, branchId: n.pr_branch_id, accYear: n.pr_acc_year, docType: TxnStatusDocType.PURCHASE_RETURN, docId: n.pr_id, refno: n.pr_refno,
        event: TxnStatusEvent.CANCELLED, from: 'POSTED', to: 'CANCELLED', actor, remarks: `Cancelled with ${refno}: ${reason}` });
    }
  }

  private async log(tx: Tx, dto: SavePurchaseInvoiceDto, id: string, refno: string, event: TxnStatusEvent, from: string | null, to: string, actor: string) {
    await appendTxnStatusLog(tx, {
      companyId: dto.header.companyId, branchId: dto.header.branchId, accYear: dto.header.accYear,
      srcModule: TxnStatusSrcModule.PURCHASE, srcDocType: TxnStatusDocType.PURCHASE_BILL, srcDocId: id, srcDocRefno: refno,
      event, fromStatus: from, toStatus: to, changedBy: actor, deviceId: dto.header.deviceId,
    });
  }
}

/** BigInt (pi_slno) → string, recursively: JSON cannot carry a BigInt. Decimals and dates serialise themselves. */
function jsonSafe<T>(v: T): T {
  if (typeof v === 'bigint') return v.toString() as unknown as T;
  if (Array.isArray(v)) return v.map((x) => jsonSafe(x)) as unknown as T;
  if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Prisma.Decimal)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = jsonSafe(x);
    return out as T;
  }
  return v;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function decimals(o: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k] = v instanceof Prisma.Decimal ? v.toFixed(Math.max(2, Math.min(6, v.decimalPlaces()))) : v;
  }
  return out;
}
void UUID;
