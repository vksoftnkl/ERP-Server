/**
 * Notes 119 / 127 §5 — every Branch Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps
 * its meaning forever: a new refusal gets a new member.
 */
export enum BranchMasterErrorCode {
  /** No branch with that id (or it is deleted) — get, update, delete, restore. */
  NOT_FOUND = 'BRANCH_NOT_FOUND',
  /** Restore asked for a branch that is not deleted. */
  NOT_DELETED = 'BRANCH_NOT_DELETED',
  /** Restore refused: the branch's company is deleted; restore the company first. */
  COMPANY_DELETED = 'BRANCH_COMPANY_DELETED',
  /** Save names a company id that has no active company. */
  COMPANY_NOT_FOUND = 'BRANCH_COMPANY_NOT_FOUND',
  /** brName is blank. */
  NAME_REQUIRED = 'BRANCH_NAME_REQUIRED',
  /** brStateCode is not exactly 2 characters. */
  STATE_CODE_INVALID = 'BRANCH_STATE_CODE_INVALID',
  /** Another branch of the same company already has this name. */
  NAME_DUPLICATE = 'BRANCH_NAME_DUPLICATE',
  /** Another branch already has this code. */
  CODE_DUPLICATE = 'BRANCH_CODE_DUPLICATE',
  /** The database refused the save on a unique index the checks above did not cover. */
  DUPLICATE = 'BRANCH_DUPLICATE',
  /** Unticking brIsDefault on the company's default branch; make another the default instead. */
  DEFAULT_UNSET_REFUSED = 'BRANCH_DEFAULT_UNSET_REFUSED',
  /** The company's default branch cannot be deleted while other live branches exist. */
  DEFAULT_UNDELETABLE = 'BRANCH_DEFAULT_UNDELETABLE',
  /** Delete refused: documents, stock, users or devices still use the branch. */
  IN_USE = 'BRANCH_IN_USE',
  /** The company's default branch cannot move to another company. */
  DEFAULT_IMMOVABLE = 'BRANCH_DEFAULT_IMMOVABLE',
  /** Move to another company refused: the branch holds documents, stock, users or devices. */
  IN_USE_IMMOVABLE = 'BRANCH_IN_USE_IMMOVABLE',
  /** brGstinNo is not 15 letters/digits in the GSTIN shape. */
  GSTIN_INVALID = 'BRANCH_GSTIN_INVALID',
  /** brGstinNo is registered in another state than brStateCode. */
  GSTIN_STATE_MISMATCH = 'BRANCH_GSTIN_STATE_MISMATCH',
  /** brPanNo does not match the PAN inside brGstinNo. */
  PAN_GSTIN_MISMATCH = 'BRANCH_PAN_GSTIN_MISMATCH',
}
