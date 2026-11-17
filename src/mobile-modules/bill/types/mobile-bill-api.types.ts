/** One godown a phone bill line may draw on. */
export interface MobileBillGodown {
  godownId: string;
  name: string;
  shortName: string | null;
  /** branch_master.br_default_godown_id of the branch. */
  isDefault: boolean;
}

/** GET /mobile/bills/options */
export interface MobileBillOptions {
  companyId: string;
  /** The branch the phone's bills for this company land in (as an upload resolves it). */
  branchId: string;
  /** The branch's live, active godowns, the default first. */
  godowns: MobileBillGodown[];
}

/** The answer to POST /mobile/bills/create, for a new bill and a resend alike. */
export interface MobileBillCreateResult {
  sbId: string;
  sbCompanyId: string;
  sbBranchId: string;
  sbAccYear: string;
  /** VK Nex's own number, from the branch's Sales Bill series. Store it on the phone. */
  sbBillRefno: string;
  /** The phone's own number, as it was sent. */
  sbUsrRefno: string | null;
  /** YYYY-MM-DD. */
  sbBillDate: string;
  /** The bill total, two decimals as text. */
  sbBillAmt: string;
  /** The bill's status NOW: POSTED when just saved; a resend reads the stored one (CANCELLED). */
  sbStatus: string;
  /** true = this client uuid was saved before: nothing was written this time. */
  duplicate: boolean;
  /** A resend of a bill the office has since deleted. */
  sbIsDeleted: boolean;
}
