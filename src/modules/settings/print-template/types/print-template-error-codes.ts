/**
 * Notes 119 / 127 §5 — every refusal the Print Template module raises
 * (`/print-templates/*`: the template, its versions and their datasets).
 *
 * `code` is what the Qt client words the box by, and the wording rows in
 * prisma/seed/Error_Messages.json are keyed on it, so every string below is an
 * API contract: rename one and the box loses its wording. Never reuse one for
 * a different meaning — add a new member instead. `field` (a path such as
 * `versions[1].datasets[0].ptdSql`) says WHERE; the code says WHAT.
 */
export enum PrintTemplateErrorCode {
  // ─── The template (§2) ───────────────────────────────────────────────────
  /** No print template has that ptlId (get, save of an existing id, delete). */
  NOT_FOUND = 'PRINT_TEMPLATE_NOT_FOUND',
  /** A field a create needs was not sent: ptlPurposeId / ptlCode / ptlName, a dataset's ptdName, a DETAIL dataset's ptdDatasetNo. */
  FIELD_REQUIRED = 'PRINT_TEMPLATE_FIELD_REQUIRED',
  /** ptlCode has a character other than letters, digits, underscore and hyphen. */
  CODE_INVALID = 'PRINT_TEMPLATE_CODE_INVALID',
  /** Another live template of the same owner already has this ptlCode. */
  CODE_TAKEN = 'PRINT_TEMPLATE_CODE_TAKEN',
  /** ptlForkedFromId names the template itself. */
  OWN_FORK = 'PRINT_TEMPLATE_OWN_FORK',
  /** Only one of ptlForkedFromId / ptlForkedFromRev was sent — they go together. */
  FORK_PAIR = 'PRINT_TEMPLATE_FORK_PAIR',
  /** ptlSortOrder is negative or not a whole number. */
  SORT_ORDER_INVALID = 'PRINT_TEMPLATE_SORT_ORDER_INVALID',
  /** Delete refused: one or more print template assignments still point at the template. */
  STILL_ASSIGNED = 'PRINT_TEMPLATE_STILL_ASSIGNED',

  // ─── A version (§3) ──────────────────────────────────────────────────────
  /** versions[i].ptvId names no revision of this template. */
  VERSION_NOT_FOUND = 'PRINT_TEMPLATE_VERSION_NOT_FOUND',
  /** ptvIsDeleted was sent on a version row with no ptvId. */
  VERSION_DELETE_NEEDS_ID = 'PRINT_TEMPLATE_VERSION_DELETE_NEEDS_ID',
  /** Delete of a PUBLISHED revision — retire it first. */
  VERSION_DELETE_PUBLISHED = 'PRINT_TEMPLATE_VERSION_DELETE_PUBLISHED',
  /** Delete of the revision the template's publish pointer names — point it elsewhere first. */
  VERSION_DELETE_IS_LIVE = 'PRINT_TEMPLATE_VERSION_DELETE_IS_LIVE',
  /** The design or the datasets of a PUBLISHED / RETIRED revision were sent — it is frozen; add a new revision. */
  VERSION_FROZEN = 'PRINT_TEMPLATE_VERSION_FROZEN',
  /** A live revision asked to move anywhere but PUBLISHED → RETIRED. */
  STATUS_MOVE_INVALID = 'PRINT_TEMPLATE_STATUS_MOVE_INVALID',
  /** ptvRevNo is already used on this template (revision numbers are never reused). */
  REV_NO_TAKEN = 'PRINT_TEMPLATE_REV_NO_TAKEN',
  /** ptvRevNo is not a positive whole number. */
  REV_NO_INVALID = 'PRINT_TEMPLATE_REV_NO_INVALID',
  /** ptvStatus is not one of the version statuses. */
  STATUS_INVALID = 'PRINT_TEMPLATE_STATUS_INVALID',
  /** ptvEngine is not one of the body engines. */
  ENGINE_INVALID = 'PRINT_TEMPLATE_ENGINE_INVALID',
  /** ptvBody is shorter or longer than the allowed length. */
  BODY_SIZE = 'PRINT_TEMPLATE_BODY_SIZE',
  /** A JSON_BANDS ptvBody does not parse, or parses to something other than a JSON object. */
  BODY_NOT_JSON_OBJECT = 'PRINT_TEMPLATE_BODY_NOT_JSON_OBJECT',
  /** ptvOrientation is not one of the orientations. */
  ORIENTATION_INVALID = 'PRINT_TEMPLATE_ORIENTATION_INVALID',
  /** ptvWidthMm / ptvHeightMm is 0 or less (send null to take it from the paper). */
  PAPER_SIZE_INVALID = 'PRINT_TEMPLATE_PAPER_SIZE_INVALID',
  /** A ptvMargin*Mm is negative. */
  MARGIN_INVALID = 'PRINT_TEMPLATE_MARGIN_INVALID',
  /** ptvColumns is outside its range (or not a whole number). */
  COLUMNS_INVALID = 'PRINT_TEMPLATE_COLUMNS_INVALID',
  /** A PUBLISHED version names no approver in ptvApprovedBy. */
  APPROVER_REQUIRED = 'PRINT_TEMPLATE_APPROVER_REQUIRED',
  /** ptvLang is not "en" / "en-IN" shaped. */
  LANG_INVALID = 'PRINT_TEMPLATE_LANG_INVALID',
  /** ptvParams is neither a JSON array of prompts nor null. */
  PARAMS_NOT_ARRAY = 'PRINT_TEMPLATE_PARAMS_NOT_ARRAY',
  /** A ptvParams entry is not an object. */
  PARAM_NOT_OBJECT = 'PRINT_TEMPLATE_PARAM_NOT_OBJECT',
  /** A prompt's name is not lower snake case starting with a letter. */
  PARAM_NAME_INVALID = 'PRINT_TEMPLATE_PARAM_NAME_INVALID',
  /** Two prompts declare the same name. */
  PARAM_NAME_TAKEN = 'PRINT_TEMPLATE_PARAM_NAME_TAKEN',
  /** A prompt's type is not one of the prompt types. */
  PARAM_TYPE_INVALID = 'PRINT_TEMPLATE_PARAM_TYPE_INVALID',
  /** A prompt's `required` is not true / false. */
  PARAM_REQUIRED_INVALID = 'PRINT_TEMPLATE_PARAM_REQUIRED_INVALID',
  /** A prompt's `label` is not text. */
  PARAM_LABEL_INVALID = 'PRINT_TEMPLATE_PARAM_LABEL_INVALID',

  // ─── The publish pointer ─────────────────────────────────────────────────
  /** More than one revision set to PUBLISHED in one request. */
  PUBLISH_TWO = 'PRINT_TEMPLATE_PUBLISH_TWO',
  /** Both ptlPublishedRevId and a revision with ptvStatus PUBLISHED were sent — send one. */
  PUBLISH_BOTH_WAYS = 'PRINT_TEMPLATE_PUBLISH_BOTH_WAYS',
  /** ptlPublishedRevId names no revision of THIS template. */
  PUBLISH_NOT_OURS = 'PRINT_TEMPLATE_PUBLISH_NOT_OURS',
  /** ptlPublishedRevId names a deleted revision. */
  PUBLISH_DELETED = 'PRINT_TEMPLATE_PUBLISH_DELETED',
  /** ptlPublishedRevId names a DRAFT or RETIRED revision. */
  PUBLISH_NOT_PUBLISHED = 'PRINT_TEMPLATE_PUBLISH_NOT_PUBLISHED',

  // ─── A dataset (§4) ──────────────────────────────────────────────────────
  /** datasets[j].ptdId names no dataset of this revision. */
  DATASET_NOT_FOUND = 'PRINT_TEMPLATE_DATASET_NOT_FOUND',
  /** ptdRole is not MASTER / DETAIL. */
  DATASET_ROLE_INVALID = 'PRINT_TEMPLATE_DATASET_ROLE_INVALID',
  /** ptdSourceKind is not one of the source kinds. */
  DATASET_SOURCE_KIND_INVALID = 'PRINT_TEMPLATE_DATASET_SOURCE_KIND_INVALID',
  /** ptdSourceKind disagrees with what is filled: a PROVIDER needs ptdProviderCode only, a SQL dataset ptdSql only. */
  DATASET_SOURCE_MISMATCH = 'PRINT_TEMPLATE_DATASET_SOURCE_MISMATCH',
  /** The MASTER is not dataset 0, or a DETAIL claims 0. */
  DATASET_MASTER_NUMBER = 'PRINT_TEMPLATE_DATASET_MASTER_NUMBER',
  /** ptdDatasetNo is outside its range. */
  DATASET_NO_INVALID = 'PRINT_TEMPLATE_DATASET_NO_INVALID',
  /** Two datasets of one version claim the same ptdDatasetNo. */
  DATASET_NO_TAKEN = 'PRINT_TEMPLATE_DATASET_NO_TAKEN',
  /** ptdName is not lower snake case starting with a letter. */
  DATASET_NAME_INVALID = 'PRINT_TEMPLATE_DATASET_NAME_INVALID',
  /** Two datasets of one version have the same ptdName. */
  DATASET_NAME_TAKEN = 'PRINT_TEMPLATE_DATASET_NAME_TAKEN',
  /** More than one MASTER dataset on one version. */
  DATASET_MASTER_TWICE = 'PRINT_TEMPLATE_DATASET_MASTER_TWICE',
  /** ptdProviderCode is not dotted lower snake case. */
  DATASET_PROVIDER_INVALID = 'PRINT_TEMPLATE_DATASET_PROVIDER_INVALID',
  /** A dataset names itself as its parent. */
  DATASET_OWN_PARENT = 'PRINT_TEMPLATE_DATASET_OWN_PARENT',
  /** The MASTER dataset names a parent. */
  DATASET_MASTER_HAS_PARENT = 'PRINT_TEMPLATE_DATASET_MASTER_HAS_PARENT',
  /** ptdParentNo names no dataset of this version. */
  DATASET_PARENT_MISSING = 'PRINT_TEMPLATE_DATASET_PARENT_MISSING',
  /** Datasets nest inside each other in a loop. */
  DATASET_PARENT_CYCLE = 'PRINT_TEMPLATE_DATASET_PARENT_CYCLE',
  /** Only one of ptdParentNo / ptdLinkFields was sent — they go together. */
  DATASET_LINK_PAIR = 'PRINT_TEMPLATE_DATASET_LINK_PAIR',
  /** ptdLinkFields is not comma-separated parent=child pairs. */
  DATASET_LINK_FIELDS_INVALID = 'PRINT_TEMPLATE_DATASET_LINK_FIELDS_INVALID',
  /** ptdRowLimit is outside its range. */
  DATASET_ROW_LIMIT_INVALID = 'PRINT_TEMPLATE_DATASET_ROW_LIMIT_INVALID',
  /** ptdTimeoutMs is outside its range. */
  DATASET_TIMEOUT_INVALID = 'PRINT_TEMPLATE_DATASET_TIMEOUT_INVALID',

  // ─── A dataset's stored SQL (the §4 guards) ──────────────────────────────
  /** ptdSql is shorter or longer than the allowed length. */
  SQL_SIZE = 'PRINT_TEMPLATE_SQL_SIZE',
  /** ptdSql uses $$ dollar quoting. */
  SQL_DOLLAR_QUOTE = 'PRINT_TEMPLATE_SQL_DOLLAR_QUOTE',
  /** ptdSql has an unclosed '…' literal or "…" identifier. */
  SQL_UNPAIRED_QUOTE = 'PRINT_TEMPLATE_SQL_UNPAIRED_QUOTE',
  /** ptdSql has an unterminated or nested block comment. */
  SQL_OPEN_COMMENT = 'PRINT_TEMPLATE_SQL_OPEN_COMMENT',
  /** ptdSql holds more than one statement. */
  SQL_MULTI_STATEMENT = 'PRINT_TEMPLATE_SQL_MULTI_STATEMENT',
  /** ptdSql does not start with SELECT or WITH. */
  SQL_NOT_SELECT = 'PRINT_TEMPLATE_SQL_NOT_SELECT',
  /** ptdSql writes (INSERT / UPDATE / DELETE / … — a data-modifying CTE too). */
  SQL_WRITES = 'PRINT_TEMPLATE_SQL_WRITES',
  /** ptdSql calls a function that reaches outside the query (files, network, catalog, sleep). */
  SQL_ESCAPE = 'PRINT_TEMPLATE_SQL_ESCAPE',
  /** ptdSql has a ":" that is not a :name parameter. */
  SQL_BAD_COLON = 'PRINT_TEMPLATE_SQL_BAD_COLON',
  /** ptdSql writes a :name parameter inside a string literal or a comment. */
  SQL_QUOTED_PARAM = 'PRINT_TEMPLATE_SQL_QUOTED_PARAM',

  // ─── The database's last word ────────────────────────────────────────────
  /** A unique index the service could not name refused the row (a concurrent save). */
  DUPLICATE = 'PRINT_TEMPLATE_DUPLICATE',
  /** A referenced record (purpose, company, fork source …) does not exist or is in use. */
  REFERENCE_INVALID = 'PRINT_TEMPLATE_REFERENCE_INVALID',
  /** A CHECK constraint the service does not restate refused the row. */
  DB_REFUSED = 'PRINT_TEMPLATE_DB_REFUSED',
}
