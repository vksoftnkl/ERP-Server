/**
 * Notes 119 / 127 §5 — every refusal the Print Render module raises
 * (`/print-render/*`: print, preview, inspect, record a print).
 *
 * `code` is what the Qt client words the box by, and the wording rows in
 * prisma/seed/Error_Messages.json are keyed on it, so every string below is an
 * API contract: rename one and the box loses its wording. Never reuse one for
 * a different meaning — add a new member instead. `field` (a path such as
 * `bands.3.elements.7.value`, `datasets.items.ptdSql` or `params.from_date`)
 * says WHERE; the code says WHAT.
 *
 * A print also resolves its design through Print Template Assignment, so the
 * same routes can answer with that module's PRINT_ASSIGN_NONE_RESOLVES.
 */
export enum PrintRenderErrorCode {
  // ─── The request ─────────────────────────────────────────────────────────
  /** The session carries no company, so no dataset can be scoped — re-authenticate against a company. */
  NO_COMPANY = 'PRINT_RENDER_NO_COMPANY',
  /** Both docId and docIds were sent — send one. */
  DOC_ID_BOTH = 'PRINT_RENDER_DOC_ID_BOTH',
  /** No active print purpose has that purposeId for this company. */
  PURPOSE_NOT_FOUND = 'PRINT_RENDER_PURPOSE_NOT_FOUND',
  /** A reprint of a purpose that allows only one print (ppoAllowReprint is false). */
  REPRINT_NOT_ALLOWED = 'PRINT_RENDER_REPRINT_NOT_ALLOWED',
  /** The assigned template has no published revision (nothing published yet, or the live one was retired). */
  NOT_PUBLISHED = 'PRINT_RENDER_NOT_PUBLISHED',
  /** No undeleted revision has that versionId for this company. */
  VERSION_NOT_FOUND = 'PRINT_RENDER_VERSION_NOT_FOUND',
  /** An unsaved body previewed against a PUBLISHED / RETIRED revision — save it as a new revision first. */
  REVISION_FROZEN = 'PRINT_RENDER_REVISION_FROZEN',
  /** The requested output mode has no renderer on this server. */
  NO_RENDERER = 'PRINT_RENDER_NO_RENDERER',
  /** The output mode does not suit the design: a character-grid design as PDF, or a page design to a roll printer. */
  MODE_MISMATCH = 'PRINT_RENDER_MODE_MISMATCH',
  /** The render took longer than its time limit and was abandoned. */
  TIMED_OUT = 'PRINT_RENDER_TIMED_OUT',

  // ─── The design ──────────────────────────────────────────────────────────
  /** The revision's engine (HTML_CSS, QTRPT_XML, RAW) has no renderer here. */
  ENGINE_NOT_RENDERABLE = 'PRINT_RENDER_ENGINE_NOT_RENDERABLE',
  /** The stored body does not parse as JSON, or is not a JSON object. */
  BODY_NOT_JSON_OBJECT = 'PRINT_RENDER_BODY_NOT_JSON_OBJECT',
  /** The revision has no bands yet — nothing has been drawn. */
  DESIGN_EMPTY = 'PRINT_RENDER_DESIGN_EMPTY',
  /** The design breaks a rule of the band schema; `field` is the path to the box that does. */
  DESIGN_INVALID = 'PRINT_RENDER_DESIGN_INVALID',

  // ─── The datasets ────────────────────────────────────────────────────────
  /** A SQL dataset has no query. */
  DATASET_NO_SQL = 'PRINT_RENDER_DATASET_NO_SQL',
  /** A dataset's query cannot be bound to its parameters. */
  DATASET_BIND_FAILED = 'PRINT_RENDER_DATASET_BIND_FAILED',
  /** A dataset's query ran past its ptdTimeoutMs and was cancelled. */
  DATASET_TIMED_OUT = 'PRINT_RENDER_DATASET_TIMED_OUT',
  /** A dataset's query failed in the database. */
  DATASET_FAILED = 'PRINT_RENDER_DATASET_FAILED',
  /** A dataset names a provider this server does not have. */
  PROVIDER_UNKNOWN = 'PRINT_RENDER_PROVIDER_UNKNOWN',
  /** A provider dataset failed to load its rows. */
  PROVIDER_FAILED = 'PRINT_RENDER_PROVIDER_FAILED',

  // ─── The operator's prompts (ptvParams) ──────────────────────────────────
  /** The revision's ptvParams is not a JSON array of prompts. */
  PARAMS_NOT_ARRAY = 'PRINT_RENDER_PARAMS_NOT_ARRAY',
  /** A ptvParams entry is not an object. */
  PARAM_NOT_OBJECT = 'PRINT_RENDER_PARAM_NOT_OBJECT',
  /** A prompt's name is not lower snake case starting with a letter. */
  PARAM_NAME_INVALID = 'PRINT_RENDER_PARAM_NAME_INVALID',
  /** A prompt's type is not one of the prompt types. */
  PARAM_TYPE_INVALID = 'PRINT_RENDER_PARAM_TYPE_INVALID',
  /** A NUMBER prompt was answered with something that is not a number. */
  PARAM_NOT_NUMBER = 'PRINT_RENDER_PARAM_NOT_NUMBER',
  /** A DATE prompt was answered with something that is not YYYY-MM-DD. */
  PARAM_NOT_DATE = 'PRINT_RENDER_PARAM_NOT_DATE',
  /** A DATETIME prompt was answered with something that is not a date and time. */
  PARAM_NOT_DATETIME = 'PRINT_RENDER_PARAM_NOT_DATETIME',
  /** A UUID prompt was answered with something that is not an id. */
  PARAM_NOT_UUID = 'PRINT_RENDER_PARAM_NOT_UUID',
  /** A required prompt was not answered. */
  PARAM_REQUIRED = 'PRINT_RENDER_PARAM_REQUIRED',
  /** An answer for a name the server decides (from the session) was sent. */
  PARAM_SERVER_OWNED = 'PRINT_RENDER_PARAM_SERVER_OWNED',
  /** An answer for a prompt the revision does not declare was sent. */
  PARAM_UNKNOWN = 'PRINT_RENDER_PARAM_UNKNOWN',
}
