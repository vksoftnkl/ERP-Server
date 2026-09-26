import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StatutoryService } from './statutory.service';
import type { RegisterDetailLine, RegisterDoc, RegisterWriteResult } from './doc-register.types';

/**
 * §3.3 — the GST view of a posted document (flow §5.7).
 *
 * ── Everything here is a SNAPSHOT ──────────────────────────────────────────
 *
 * The party's name, address, state and GSTIN are copied off the DOCUMENT, not
 * joined from `customers`. A walk-in types a GSTIN onto the bill and that
 * typed GSTIN is what makes the sale B2B — a join would show a blank, and
 * editing the master next month would silently rewrite a return already filed.
 *
 * ── The two applicability flags are the SERVER's to decide ─────────────────
 *
 * `gdr_is_einvoice_applicable` and `gdr_is_ewaybill_applicable` come from
 * `StatutoryService` on the DOCUMENT's date, never from the client. The till
 * computes them too, offline, from the same law pack — but what gets filed is
 * what the server decided.
 *
 * ── A cancel CANCELS; an amend REISSUES ────────────────────────────────────
 *
 * `cancel()` sets the row CANCELED with a reason and a date. `reissue()`
 * cancels the old row and writes a new one, and the IRN history stays on the
 * OLD row — which is the point: the old IRN was really generated, was really
 * cancelled at the portal, and a register that forgot it could not answer a
 * notice.
 */
@Injectable()
export class DocRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statutory: StatutoryService,
  ) {}

  /** Write the register row and its detail lines. Returns `gdrId`. */
  async write(
    tx: Prisma.TransactionClient,
    doc: RegisterDoc,
    opts: { companyEinvoiceFlag?: boolean; aatoAmount?: number | null; interState?: boolean } = {},
  ): Promise<RegisterWriteResult> {
    const interState = opts.interState ?? doc.supplyNature === 'INTER_STATE';

    const [einv, eway] = await Promise.all([
      this.statutory.einvoiceApplicable(
        doc.companyId,
        doc.docDate,
        {
          aatoAmount: opts.aatoAmount ?? null,
          companyFlag: opts.companyEinvoiceFlag ?? false,
        },
        tx,
      ),
      this.statutory.ewayApplicable(
        doc.companyId,
        doc.billValue,
        doc.docDate,
        { interState, stateCode: doc.placeOfSupplyCode ?? null },
        tx,
      ),
    ]);

    // A BILL_OF_SUPPLY is never an e-invoice: it is raised precisely because
    // the supply carries no tax to report. Nor is a challan (Q8): it moves
    // goods and raises no debt, so only the e-way bill applies to it.
    const einvoiceApplicable =
      doc.docType === 'BILL_OF_SUPPLY' ||
      doc.docType === 'DELIVERY_CHALLAN' ||
      doc.docType === 'CHALLAN'
        ? false
        : einv.applicable;

    const [row] = await tx.$queryRaw<{ gdr_id: string }[]>`
      INSERT INTO accounts.acc_voucher_doc_register (
        gdr_source_module, gdr_tran_nature, gdr_doc_flow, gdr_doc_sign,
        gdr_source_doc_id, gdr_acc_year, gdr_company_id, gdr_branch_id,
        gdr_voucher_type_id, gdr_voucher_id, gdr_voucher_no, gdr_voucher_date,
        gdr_voucher_refno,
        gdr_doc_type, gdr_doc_no, gdr_doc_date, gdr_doc_ref_no, gdr_doc_status,
        gdr_supply_class, gdr_taxability, gdr_supply_nature,
        gdr_place_of_supply_code, gdr_place_of_supply_name,
        gdr_is_reverse_charge, gdr_is_einvoice_applicable, gdr_is_ewaybill_applicable,
        gdr_party_type, gdr_party_id, gdr_party_name,
        gdr_party_addr1, gdr_party_addr2, gdr_party_addr3,
        gdr_party_location, gdr_party_pin,
        gdr_party_state_code, gdr_party_state_name,
        gdr_party_gst_type, gdr_party_gstin,
        gdr_gross_value, gdr_discount_value, gdr_taxable_value,
        gdr_cgst_value, gdr_sgst_value, gdr_igst_value,
        gdr_cess_value, gdr_state_cess_value, gdr_tcs_value,
        gdr_other_charge, gdr_round_off, gdr_bill_value,
        gdr_remarks, gdr_igst_on_intra, gdr_created_by
      ) VALUES (
        ${doc.sourceModule ?? 'SALES'}::accounts."GdrSourceModule",
        ${doc.tranNature}::accounts."GdrTranNature",
        ${doc.docFlow}::accounts."GdrDocFlow",
        ${doc.docSign}::int,
        ${doc.sourceDocId}::uuid, ${doc.accYear}::char(9),
        ${doc.companyId}::uuid, ${doc.branchId}::uuid,
        ${doc.voucherTypeId}::int, ${doc.voucherId}::uuid,
        ${doc.voucherNo}::bigint, ${doc.voucherDate}::date,
        ${doc.voucherRefno ?? null},
        ${doc.docType}::accounts."GdrDocType", ${doc.docNo}, ${doc.docDate}::date,
        ${doc.docRefNo ?? null}, 'POSTED'::accounts."GdrDocStatus",
        ${doc.supplyClass ?? null}::accounts."GdrSupplyClass",
        ${doc.taxability}::accounts."GdrTaxability",
        ${doc.supplyNature ?? null}::accounts."GdrSupplyNature",
        ${doc.placeOfSupplyCode ?? null}, ${doc.placeOfSupplyName ?? null},
        ${doc.isReverseCharge ?? false}, ${einvoiceApplicable}, ${eway.applicable},
        ${doc.partyType ?? 'CUSTOMER'}::accounts."GdrPartyType", ${doc.partyId}::uuid, ${doc.partyName ?? null},
        ${doc.partyAddr1 ?? null}, ${doc.partyAddr2 ?? null}, ${doc.partyAddr3 ?? null},
        ${doc.partyLocation ?? null}, ${doc.partyPin ?? null},
        ${doc.partyStateCode ?? null}, ${doc.partyStateName ?? null},
        ${doc.partyGstType ?? null}, ${doc.partyGstin ?? null},
        ${money(doc.grossValue)}::numeric, ${money(doc.discountValue)}::numeric,
        ${money(doc.taxableValue)}::numeric,
        ${money(doc.cgstValue)}::numeric, ${money(doc.sgstValue)}::numeric,
        ${money(doc.igstValue)}::numeric,
        ${money(doc.cessValue)}::numeric, ${money(doc.stateCessValue)}::numeric,
        ${money(doc.tcsValue)}::numeric,
        ${money(doc.otherCharge)}::numeric, ${money(doc.roundOff)}::numeric,
        ${money(doc.billValue)}::numeric,
        ${doc.remarks ?? null}, ${doc.igstOnIntra ?? false}, ${uuidOrNull(doc.createdBy)}::uuid
      )
      RETURNING gdr_id`;

    const gdrId = row.gdr_id;
    const lineCount = await this.writeDetails(tx, doc, gdrId);

    return {
      gdrId,
      einvoiceApplicable,
      ewaybillApplicable: eway.applicable,
      lineCount,
    };
  }

  /**
   * The LIVE register row of a source document, for the tables that carry no
   * `*_doc_register_id` of their own (challans, returns). The most recent
   * non-cancelled row wins; with none, the most recent row — a cancelled
   * document still has a register history to show.
   */
  async registerIdOf(
    c: Prisma.TransactionClient,
    sourceDocId: string,
    accYear: string,
  ): Promise<string | null> {
    const rows = await c.$queryRaw<{ gdr_id: string }[]>`
      SELECT gdr_id FROM accounts.acc_voucher_doc_register
       WHERE gdr_source_doc_id = ${sourceDocId}::uuid AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_is_deleted = false
       ORDER BY (gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus") DESC, gdr_created_on DESC
       LIMIT 1`;
    return rows[0]?.gdr_id ?? null;
  }

  /** The live register row a VOUCHER wrote (the Voucher Register's own key). */
  async registerIdOfVoucher(
    c: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
  ): Promise<string | null> {
    const rows = await c.$queryRaw<{ gdr_id: string }[]>`
      SELECT gdr_id FROM accounts.acc_voucher_doc_register
       WHERE gdr_voucher_id = ${voucherId}::uuid AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_is_deleted = false
       ORDER BY (gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus") DESC, gdr_created_on DESC
       LIMIT 1`;
    return rows[0]?.gdr_id ?? null;
  }

  /**
   * Cancel the register row. `chk_gdr_doc_cancel_date` makes the date
   * mandatory, so nothing here may leave it out.
   */
  async cancel(
    tx: Prisma.TransactionClient,
    gdrId: string,
    accYear: string,
    reason: string,
    actor = 'SYSTEM',
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE accounts.acc_voucher_doc_register
         SET gdr_doc_status        = 'CANCELED'::accounts."GdrDocStatus",
             gdr_doc_cancel_reason = ${reason},
             gdr_doc_canceled_on   = now(),
             gdr_updated_on        = now(),
             gdr_updated_by        = ${uuidOrNull(actor)}::uuid
       WHERE gdr_id       = ${gdrId}::uuid
         AND gdr_acc_year = ${accYear}::char(9)
         AND gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus"`;
  }

  /**
   * Amend of a document nothing was declared for: RETIRE the row (soft delete)
   * so the re-post can file the same document number again.
   *
   * Not `cancel()`: the three unique rules in the way —
   * `uq_acc_voucher_doc_register_source`, `_doc` and `_voucher` — are partial
   * on `gdr_is_deleted` only, so a CANCELED row still holds the number and the
   * re-post answered 23505. And not a lie either: a CANCELED row asserts the
   * invoice was cancelled, and an amended one was not. There is no IRN or
   * e-way bill history to keep here — `assertAmendable` refuses the amend of a
   * declared document before anything is unwound; that case is `reissue()`.
   */
  async retire(
    tx: Prisma.TransactionClient,
    gdrId: string,
    accYear: string,
    actor = 'SYSTEM',
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE accounts.acc_voucher_doc_register
         SET gdr_is_deleted = true,
             gdr_updated_on = now(),
             gdr_updated_by = ${uuidOrNull(actor)}::uuid
       WHERE gdr_id         = ${gdrId}::uuid
         AND gdr_acc_year   = ${accYear}::char(9)
         AND gdr_is_deleted = false`;
  }

  /**
   * Amend: cancel the old row and write a new one.
   *
   * The IRN and e-way bill history stay on the OLD row — `acc_voucher_doc_
   * einvoice` and `_ewaybill` key on `gdr_id`, and they are the record of what
   * was actually declared. Moving them to the new row would erase the fact
   * that a different invoice once existed under the same number.
   */
  async reissue(
    tx: Prisma.TransactionClient,
    oldGdrId: string,
    doc: RegisterDoc,
    opts: {
      reason?: string;
      actor?: string;
      companyEinvoiceFlag?: boolean;
      aatoAmount?: number | null;
      interState?: boolean;
    } = {},
  ): Promise<RegisterWriteResult> {
    await this.cancel(
      tx,
      oldGdrId,
      doc.accYear,
      opts.reason ?? 'Superseded by an amendment',
      opts.actor ?? 'SYSTEM',
    );
    return this.write(tx, doc, opts);
  }

  private async writeDetails(
    tx: Prisma.TransactionClient,
    doc: RegisterDoc,
    gdrId: string,
  ): Promise<number> {
    if (doc.lines.length === 0) {
      return 0;
    }

    const values = doc.lines.map(inStateRates).map(
      (l) => Prisma.sql`(
        ${gdrId}::uuid, ${doc.voucherId}::uuid, ${l.rowNo}::int,
        ${doc.accYear}::char(9), ${doc.companyId}::uuid, ${doc.branchId}::uuid,
        -- The detail table has its own two enums, label-compatible with the
        -- register's but distinct types: a GdrTaxability cast here is a 42804.
        ${l.taxability}::accounts."VoucherDocDetailTaxability",
        ${l.supplyNature}::accounts."VoucherDocDetailSupplyNature",
        ${l.itemId ?? null}::uuid, ${l.itemCode ?? null}, ${l.itemName ?? null},
        ${l.description ?? null}, ${l.hsnCode ?? null}, ${l.unitId ?? null}::uuid,
        ${num(l.qty, 4)}::numeric, ${money(l.rate)}::numeric, ${money(l.discount)}::numeric,
        ${l.isService}, ${money(l.taxableValue)}::numeric,
        ${num(l.totalTaxRate, 2)}::numeric, ${l.taxId ?? null}::uuid,
        ${num(l.cgstRate, 2)}::numeric, ${num(l.sgstRate, 2)}::numeric,
        ${num(l.igstRate, 2)}::numeric, ${num(l.cessRate, 2)}::numeric,
        ${money(l.cgstAmount)}::numeric, ${money(l.sgstAmount)}::numeric,
        ${money(l.igstAmount)}::numeric, ${money(l.cessAmount)}::numeric,
        ${money(l.cgstAmount + l.sgstAmount + l.igstAmount + l.cessAmount)}::numeric,
        ${money(l.otherAmount)}::numeric, ${money(l.totalValue)}::numeric,
        ${money(l.billValue)}::numeric,
        ${l.taxableLedgerId ?? null}::uuid, ${l.cgstLedgerId ?? null}::uuid,
        ${l.sgstLedgerId ?? null}::uuid, ${l.igstLedgerId ?? null}::uuid,
        ${l.cessLedgerId ?? null}::uuid, ${l.itcEligibility ?? null},
        ${uuidOrNull(doc.createdBy)}::uuid
      )`,
    );

    return tx.$executeRaw`
      INSERT INTO accounts.acc_voucher_doc_detail (
        vtx_gdr_id, vtx_voucher_id, vtx_row_no,
        vtx_acc_year, vtx_company_id, vtx_branch_id,
        vtx_taxability, vtx_supply_nature,
        vtx_item_id, vtx_item_code, vtx_item_name,
        vtx_item_description, vtx_hsn_code, vtx_unit_id,
        vtx_item_qty, vtx_item_rate, vtx_item_discount,
        vtx_is_service, vtx_taxable_value,
        vtx_total_tax_rate, vtx_tax_id,
        vtx_cgst_rate, vtx_sgst_rate, vtx_igst_rate, vtx_cess_rate,
        vtx_cgst_amount, vtx_sgst_amount, vtx_igst_amount, vtx_cess_amount,
        vtx_total_tax_amount, vtx_other_amount, vtx_total_value,
        vtx_bill_value,
        vtx_taxable_ledger_id, vtx_cgst_ledger_id, vtx_sgst_ledger_id, vtx_igst_ledger_id,
        vtx_cess_ledger_id, vtx_itc_eligibility,
        vtx_created_by
      )
      VALUES ${Prisma.join(values)}`;
  }
}

/**
 * The line carries the item's whole rate block — the price lookup answers
 * cgst 9 / sgst 9 / igst 18 for an 18% item, and the screens copy all three —
 * but the register holds only the rates the supply actually charged.
 * chk_acc_voucher_doc_detail_supply_tax_logic refuses an INTRA_STATE row with
 * an IGST rate (and the reverse), so the unused pair is zeroed here, once, for
 * every document that writes the register.
 */
function inStateRates(l: RegisterDetailLine): RegisterDetailLine {
  return l.supplyNature === 'INTER_STATE'
    ? { ...l, cgstRate: 0, sgstRate: 0 }
    : { ...l, igstRate: 0 };
}

function money(v: number): string {
  return num(v, 2);
}

/**
 * `gdr_created_by` / `gdr_updated_by` / `vtx_created_by` are uuid columns, not
 * the varchar actor the rest of accounts carries: the nil actor and 'SYSTEM'
 * become NULL here rather than a 42804 the operator cannot read.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrNull(v: string | null | undefined): string | null {
  return v && UUID.test(v) && v !== '00000000-0000-0000-0000-000000000000' ? v : null;
}

function num(v: number, decimals: number): string {
  const f = Math.pow(10, decimals);
  return (Math.round((v + Number.EPSILON * Math.sign(v || 1)) * f) / f).toFixed(decimals);
}
