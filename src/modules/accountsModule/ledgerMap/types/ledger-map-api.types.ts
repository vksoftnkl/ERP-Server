export type { AccountsErrorDetail as LedgerMapErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as LedgerMapErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as LedgerMapSuccessResponse } from 'src/common/types/module-api.types';

/**
 * One posting role, and the ledger it resolves to — or the fact that it
 * resolves to nothing.
 *
 * The catalogue half (role .. roleIsActive) comes from
 * `accounts.acc_ledger_role` and is the same for every installation; the
 * mapping half (almId .. remarks) comes from `accounts.acc_ledger_map` and is
 * null on a role nobody has mapped. That a row can be ALL nulls is the point:
 * the screen has to show an unmapped role as loudly as a mapped one.
 */
export interface LedgerMapRolePayload {
  /** acc_ledger_role.alr_role — the stable code the engines ask by. */
  role: string;
  /** alr_label. What the screen shows; nobody should have to read the code. */
  label: string;
  /** alr_group — REVENUE | OUTPUT_TAX | PURCHASE | INPUT_TAX | SHARED | RECEIPT | FUTURE. */
  group: string;
  /** alr_sort_order — the order the bands and the rows within them are meant to read. */
  sortOrder: number;
  /**
   * alr_want_type. The ledger type this role demands, and the filter the
   * ledger picker should apply. Null = not checked on this axis.
   */
  expectedLedgerType: string | null;
  /** alr_want_duty — the GST duty head, for the tax roles. Null = not checked. */
  expectedDutyHead: string | null;
  /** alr_want_nature — the account group's nature. Null = not checked. */
  expectedGroupNature: string | null;
  /** alr_is_active. An inactive role resolves to nothing even when mapped. */
  roleIsActive: boolean;
  /**
   * The documents that post this role today. Non-empty is what makes
   * `/ledger-map/delete` refuse.
   */
  usedBy: string[];
  /** alm_id — null when the role has no mapping. */
  almId: string | null;
  /** alm_ledger_id — null when the role has no mapping. */
  ledgerId: string | null;
  ledgerName: string | null;
  /**
   * The ledger's own flags. A mapping is resolved without looking at them, so a
   * mapping pointing at an inactive or deleted ledger still posts — the screen
   * should say so, which it cannot do unless they are here.
   */
  ledgerIsActive: boolean | null;
  ledgerIsDeleted: boolean | null;
  /** alm_is_active — null when unmapped. False resolves to nothing. */
  isActive: boolean | null;
  /** alm_remarks — null when unmapped. */
  remarks: string | null;
}

/** What `/ledger-map/create` gives back: the role, exactly as `/roles` shows it. */
export type LedgerMapPayload = LedgerMapRolePayload;

export interface LedgerMapDeletePayload {
  almId: string;
  role: string;
  deleted: true;
}
