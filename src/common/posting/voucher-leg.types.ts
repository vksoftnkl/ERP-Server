import type { SupplyNature } from '../../modules/accountsModule/ledgerRole/ledger-map.helper';

/**
 * One line of a voucher.
 *
 * **Amounts are ALWAYS POSITIVE and `drCr` carries the side** (flow §5.3).
 * A negative amount would fail `ck_av_amount`, and more importantly it would
 * let one leg mean two things depending on who read it.
 *
 * A leg names EITHER a role — resolved through `acc_ledger_map` /
 * `tax_rate_ledger` — OR an explicit ledger, which is what the party and
 * tender legs use because their ledger is a fact of the document rather than a
 * configuration.
 */
export interface VoucherLeg {
  /** `acc_ledger_role.alr_role`, e.g. 'SALES' or 'OUTPUT_CGST'. */
  role?: string | null;
  /** An explicit ledger. Mutually exclusive with `role`. */
  ledgerId?: string | null;
  drCr: 'DR' | 'CR';
  /** Positive. `drCr` is the sign. */
  amount: number;
  /** The rate this line was taxed under — picks a per-rate ledger override. */
  taxId?: string | null;
  supplyNature?: SupplyNature | null;
  remarks?: string | null;
  /** Bill-wise: which document row this leg settles. */
  docId?: string | null;
  docAccYear?: string | null;
  docRefno?: string | null;
  /** Where an unresolved role should report itself, e.g. `items.3.sbiTaxId`. */
  field?: string;
  /** Written to `av_role`, so a report can find "every sales leg" later. */
  roleTag?: string | null;
}

/** The voucher header this leg set belongs to. */
export interface VoucherHeaderInput {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  accYear: string;
  voucherTypeId: number;
  voucherDate: string;
  /**
   * `avh_src_module`: 'SALES' for a document's voucher. The Voucher Register's
   * vouchers ARE the document and carry no source at all (ck_avh_src: the three
   * src columns are all set or all null).
   */
  srcModule?: string | null;
  /** `ux_avh_src` makes (company, module, doc_type, doc_id, year) unique. */
  srcDocType?: string | null;
  srcDocId?: string | null;
  /** What a refusal calls the document when it has no srcDocType ("Purchase (Accounting)"). */
  docLabel?: string | null;
  docRefno?: string | null;
  docDate?: string | null;
  usrRefno?: string | null;
  /** `avh_doc_amount` — the document's face value, not the leg total. */
  docAmount: number;
  roundOff?: number;
  /** NULL for a Contra, and for a multi-party Journal (register decision A). */
  partyId: string | null;
  userId: string;
  sessionId?: string | null;
  deviceType?: string | null;
  deviceId?: string | null;
  remarks?: string | null;
  /** POS → the device's own series; WHOLESALE → `seq_device_code 'MAIN'`. */
  deviceCode?: string | null;
  createdBy?: string;
  /**
   * A number the DOCUMENT already holds (`sb_bill_refno`, drawn from the same
   * voucher type at `/create`). When set, the voucher takes it instead of
   * drawing a second one — a bill and its voucher must print the same number.
   */
  presetRefno?: string | null;
  presetNo?: bigint | null;
  /**
   * Amend: the voucher `retireForRestate` took back to DRAFT. The legs are
   * written into THAT header — same id, number and refno, revision + 1 — and
   * no number is drawn. The preset fields are ignored when this is set.
   */
  restateVoucherId?: string | null;
  /**
   * The Voucher Register: the DRAFT header `/create` wrote. The legs go into
   * it and it is numbered and POSTED now. Exclusive with `restateVoucherId`.
   */
  draftVoucherId?: string | null;
}

/** What a document hands `VoucherPostingService`. */
export interface VoucherLegSource {
  header: VoucherHeaderInput;
  legs: VoucherLeg[];
}

export interface VoucherPostingResult {
  voucherId: string;
  voucherNo: string | null;
  voucherRefno: string | null;
  voucherSlno: bigint;
  /** The numeric counter behind `voucherRefno` — `gdr_voucher_no` wants it. */
  voucherLastNo: bigint;
  postedOn: Date;
  totalDebit: number;
  totalCredit: number;
  legCount: number;
}
