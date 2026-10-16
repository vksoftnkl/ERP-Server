/**
 * Notes 119 / 127 §5 — every refusal the Print Template Assignment module
 * raises (`/print-template-assignments/*`: which design a company, branch or
 * counter prints a purpose with).
 *
 * `code` is what the Qt client words the box by, and the wording rows in
 * prisma/seed/Error_Messages.json are keyed on it, so every string below is an
 * API contract: rename one and the box loses its wording. Never reuse one for
 * a different meaning — add a new member instead.
 *
 * NONE_RESOLVES also reaches the print and preview routes (`/print-render/*`),
 * which resolve the design through this module.
 */
export enum PrintTemplateAssignmentErrorCode {
  /** No live assignment has that ptaId (get, update, delete). */
  NOT_FOUND = 'PRINT_ASSIGN_NOT_FOUND',
  /** No assignment resolves for the company / branch / counter / purpose / output mode asked about — nothing is set up to print it. */
  NONE_RESOLVES = 'PRINT_ASSIGN_NONE_RESOLVES',
  /** Resolve with no company: none was sent and the session carries none. */
  COMPANY_MISSING = 'PRINT_ASSIGN_COMPANY_MISSING',
  /** Create without ptaCompanyId — the company must be stated (null = every company, on purpose). */
  COMPANY_NOT_STATED = 'PRINT_ASSIGN_COMPANY_NOT_STATED',
  /** ptaTemplateId names no live print template. */
  TEMPLATE_NOT_FOUND = 'PRINT_ASSIGN_TEMPLATE_NOT_FOUND',
  /** The template is private to another company (or an every-company row names a company's own design) — fork it, then assign the fork. */
  TEMPLATE_PRIVATE = 'PRINT_ASSIGN_TEMPLATE_PRIVATE',
  /** A counter-scoped assignment names no branch. */
  DEVICE_NEEDS_BRANCH = 'PRINT_ASSIGN_DEVICE_NEEDS_BRANCH',
  /** A branch-scoped assignment names no company. */
  BRANCH_NEEDS_COMPANY = 'PRINT_ASSIGN_BRANCH_NEEDS_COMPANY',
  /** Both a registered printer profile and a bare printer name were sent — give one. */
  PRINTER_BOTH = 'PRINT_ASSIGN_PRINTER_BOTH',
  /** An assignment already exists for this company / branch / counter / purpose / output mode — update it instead. */
  ALREADY_EXISTS = 'PRINT_ASSIGN_ALREADY_EXISTS',
  /** A referenced company, branch, counter, purpose, template or printer profile does not exist. */
  REFERENCE_INVALID = 'PRINT_ASSIGN_REFERENCE_INVALID',
  /** A CHECK constraint the service does not restate refused the row. */
  DB_REFUSED = 'PRINT_ASSIGN_DB_REFUSED',
}
