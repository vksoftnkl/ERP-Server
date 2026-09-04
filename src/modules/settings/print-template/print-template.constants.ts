/// Every vocabulary and every bound the three print_template_* tables enforce
/// as a CHECK, restated once so the service and the DTOs cannot drift apart.
///
/// The schema fragments say this explicitly: the models are declared WITHOUT
/// their CHECK constraints, and each one lists what "lives in the migration and
/// in PrintTemplateService". This file is that list, and
/// utils/print-template-invariants.ts is where each entry becomes a refusal
/// with a field name and a sentence.
///
/// Widen a list here and in 20260827121000_add_printing_engine together, never
/// one alone — the same rule PTA_OUTPUT_MODES carries.

// ── §2 print_template (ptl_) ──────────────────────────────────────────────

/// ck_ptl_code_shape
export const PTL_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
export const PTL_CODE_MAX_LENGTH = 60;
export const PTL_NAME_MAX_LENGTH = 120;

// ── §3 print_template_version (ptv_) ──────────────────────────────────────

/// ck_ptv_status. DRAFT is editable, PUBLISHED and RETIRED are not.
export const PTV_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;
export type PtvStatus = (typeof PTV_STATUSES)[number];
export const PTV_DEFAULT_STATUS: PtvStatus = 'DRAFT';

/// ck_ptv_engine — what ptv_body IS. 3.0 had no such column, so moving off
/// QtRPT would have been a flag day for every customer at once.
export const PTV_ENGINES = ['JSON_BANDS', 'HTML_CSS', 'QTRPT_XML', 'ESCPOS_TEXT', 'RAW'] as const;
export type PtvEngine = (typeof PTV_ENGINES)[number];
export const PTV_DEFAULT_ENGINE: PtvEngine = 'JSON_BANDS';

/// The one engine ck_ptv_body_is_json applies to.
export const PTV_JSON_ENGINE: PtvEngine = 'JSON_BANDS';

/// ck_ptv_orientation
export const PTV_ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'] as const;
export type PtvOrientation = (typeof PTV_ORIENTATIONS)[number];
export const PTV_DEFAULT_ORIENTATION: PtvOrientation = 'PORTRAIT';

/// ck_ptv_body_size
export const PTV_BODY_MIN_LENGTH = 1;
export const PTV_BODY_MAX_LENGTH = 4_000_000;

/// ck_ptv_geometry — the only bounded half. Widths, heights and margins are
/// checked by sign, not by range.
export const PTV_COLUMNS_MIN = 20;
export const PTV_COLUMNS_MAX = 250;

/// ck_ptv_lang_shape — 'en', 'en-IN', 'ta-IN'.
export const PTV_LANG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
export const PTV_DEFAULT_LANG = 'en-IN';

export const PTV_PAPER_CODE_MAX_LENGTH = 20;
export const PTV_FONT_FAMILY_MAX_LENGTH = 80;
export const PTV_NOTE_MAX_LENGTH = 250;

/// The types a ptv_params entry may declare. Not a CHECK — jsonb_typeof only
/// proves the column is an array — so this list exists solely here, and the
/// operator prompt screen is what reads it.
export const PTV_PARAM_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DATETIME', 'BOOLEAN', 'UUID'] as const;
export type PtvParamType = (typeof PTV_PARAM_TYPES)[number];

/// CONTEXT PARAMETERS — the names the render fills IN BY DEFAULT when the
/// revision declares nothing for them.
///
/// They used to be a CLOSED SET that a revision was forbidden to declare. That
/// refusal is gone: `ptv_params` is now the whole story, so an author who wants
/// `:doc_id` to come from somewhere other than the print request declares it in
/// the prompts table like any other parameter and answers it at render time.
///
/// What is left is a FALLBACK, and only a fallback. A query binding `:doc_id`
/// on a revision that declares no such prompt still gets the document being
/// printed, so every design written before this change keeps printing; and a
/// declared prompt left unanswered falls back to the same value rather than
/// binding NULL.
export const PTV_CONTEXT_PARAMS = [
  'company_id',
  'branch_id',
  'acc_year',
  'doc_id',
  'user_id',
  'device_id',
] as const;

/// The one context name whose VALUE is still the server's alone.
///
/// It may be declared as a prompt like any other — the declaration is what puts
/// it on the operator's screen and in the payload's shape — but an ANSWER to it
/// is refused and the authenticated company is bound regardless. A render reads
/// a company's documents, so a caller able to name the company is a caller able
/// to print another tenant's data, and no amount of authoring freedom is worth
/// that. Empty this list to hand company selection to the template author.
export const PTV_SERVER_OWNED_PARAMS = ['company_id'] as const;

/// Same shape ck_ptd_name_shape uses: both name something a query addresses.
export const PTV_PARAM_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

// ── §4 print_template_dataset (ptd_) ──────────────────────────────────────

/// ck_ptd_role. MASTER is the header context, read once; DETAIL repeats.
export const PTD_ROLES = ['MASTER', 'DETAIL'] as const;
export type PtdRole = (typeof PTD_ROLES)[number];
export const PTD_DEFAULT_ROLE: PtdRole = 'DETAIL';

/// ck_ptd_source_kind. A code-registered PROVIDER for anything needing joins
/// across partitioned tables or real business logic; stored SQL for everything
/// else, so a new report costs no release.
export const PTD_SOURCE_KINDS = ['PROVIDER', 'SQL'] as const;
export type PtdSourceKind = (typeof PTD_SOURCE_KINDS)[number];
export const PTD_DEFAULT_SOURCE_KIND: PtdSourceKind = 'PROVIDER';

/// ck_ptd_master_is_zero — the master is dataset 0, and nothing else is.
export const PTD_MASTER_DATASET_NO = 0;

/// ck_ptd_dataset_no
export const PTD_DATASET_NO_MIN = 0;
export const PTD_DATASET_NO_MAX = 99;

/// ck_ptd_name_shape
export const PTD_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const PTD_NAME_MAX_LENGTH = 40;
export const PTD_LABEL_MAX_LENGTH = 120;

/// ck_ptd_provider_shape — dotted lower snake, e.g. sales.bill.tax_summary
export const PTD_PROVIDER_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
export const PTD_PROVIDER_MAX_LENGTH = 80;

/// ck_ptd_link_fields_shape — parent=child, comma separated, no spaces. LEFT is
/// a column the PARENT dataset returns, RIGHT is one THIS dataset returns;
/// neither side is a bound parameter.
export const PTD_LINK_FIELDS_PATTERN =
  /^[a-z][a-z0-9_]*=[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*=[a-z][a-z0-9_]*)*$/;
export const PTD_LINK_FIELDS_MAX_LENGTH = 200;

/// ck_ptd_limits. Both measure THE WHOLE BAND, not one child execution — the
/// child query runs once for the whole render, not once per parent row.
export const PTD_ROW_LIMIT_MIN = 1;
export const PTD_ROW_LIMIT_MAX = 200_000;
export const PTD_DEFAULT_ROW_LIMIT = 5_000;
export const PTD_TIMEOUT_MS_MIN = 100;
export const PTD_TIMEOUT_MS_MAX = 120_000;
export const PTD_DEFAULT_TIMEOUT_MS = 15_000;

/// ck_ptd_sql_size
export const PTD_SQL_MIN_LENGTH = 20;
export const PTD_SQL_MAX_LENGTH = 20_000;

export const PTD_REMARKS_MAX_LENGTH = 250;

/// A screen name the audit log groups every write in this module under.
export const PRINT_TEMPLATE_SCREEN_NAME = 'Print Template';
