/**
 * Notes 119 / 127 §5 — every refusal of the Sale Agent master (/sale-agents)
 * carries one of these as `errors[].code`; the client words its box by the code
 * alone. One meaning per code: a site with a new meaning gets a new member,
 * never an old one.
 */
export enum SaleAgentErrorCode {
  /** saName was blank. */
  NAME_REQUIRED = 'SALE_AGENT_NAME_REQUIRED',
  /** Another live sale agent of the company (or its linked ledger) already has this name. */
  NAME_EXISTS = 'SALE_AGENT_NAME_EXISTS',
  /** Another live sale agent of the company already has this saCode. */
  CODE_EXISTS = 'SALE_AGENT_CODE_EXISTS',
  /** The database refused the write as a duplicate sale agent (a unique index). */
  DUPLICATE = 'SALE_AGENT_DUPLICATE',
  /** No live sale agent with this saId. */
  NOT_FOUND = 'SALE_AGENT_NOT_FOUND',
  /** saCompanyId names no live company. */
  COMPANY_NOT_FOUND = 'SALE_AGENT_COMPANY_NOT_FOUND',
  /** saBranchId names no live branch. */
  BRANCH_NOT_FOUND = 'SALE_AGENT_BRANCH_NOT_FOUND',
  /** The sale agent group named does not exist or was deleted. */
  GROUP_NOT_FOUND = 'SALE_AGENT_GROUP_NOT_FOUND',
  /** A foreign key refused the write: the company, branch or group it names is gone. */
  REFERENCE_NOT_FOUND = 'SALE_AGENT_REFERENCE_NOT_FOUND',
  /** No account group exists at all, so the agent's linked ledger cannot be created. */
  NO_ACCOUNT_GROUP = 'SALE_AGENT_NO_ACCOUNT_GROUP',
}
