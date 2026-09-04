import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import {
  PTD_DATASET_NO_MAX,
  PTD_DATASET_NO_MIN,
  PTD_LINK_FIELDS_PATTERN,
  PTD_MASTER_DATASET_NO,
  PTD_NAME_PATTERN,
  PTD_PROVIDER_PATTERN,
  PTD_ROLES,
  PTD_ROW_LIMIT_MAX,
  PTD_ROW_LIMIT_MIN,
  PTD_SOURCE_KINDS,
  PTD_TIMEOUT_MS_MAX,
  PTD_TIMEOUT_MS_MIN,
  PTL_CODE_PATTERN,
  PTV_BODY_MAX_LENGTH,
  PTV_BODY_MIN_LENGTH,
  PTV_COLUMNS_MAX,
  PTV_COLUMNS_MIN,
  PTV_ENGINES,
  PTV_JSON_ENGINE,
  PTV_LANG_PATTERN,
  PTV_ORIENTATIONS,
  PTV_PARAM_NAME_PATTERN,
  PTV_PARAM_TYPES,
  PTV_STATUSES,
} from '../print-template.constants';
import { collectDatasetSqlErrors } from './print-template-sql-guards';

/**
 * Every CHECK the three tables do not carry in Prisma, one named function
 * apiece — the shape promotion-scheme-invariants.ts established.
 *
 * All of them COLLECT rather than short-circuit, so a bad payload comes back
 * with every one of its problems at once. A designer saving a template is
 * filling a long form; answering one complaint per round trip is the difference
 * between a fixable error and an argument with the server.
 *
 * `path` is the caller's coordinate into the payload — 'versions[1].datasets[0]'
 * — so an error on the third dataset of the second version says which row it
 * means. The header passes '' and its fields are named bare.
 */

const at = (path: string, field: string): string => (path ? `${path}.${field}` : field);

// ═══ §2 print_template ═════════════════════════════════════════════════════

export interface EffectiveTemplate {
  ptlId: string | null;
  ptlCode: string;
  ptlSortOrder: number;
  ptlForkedFromId: string | null;
  ptlForkedFromRev: number | null;
}

/** ck_ptl_code_shape */
function checkTemplateCodeShape(template: EffectiveTemplate, errors: ModuleErrorDetail[]): void {
  if (!PTL_CODE_PATTERN.test(template.ptlCode)) {
    errors.push({
      field: 'ptlCode',
      message: 'ptlCode may contain only letters, digits, underscore and hyphen',
    });
  }
}

/** ck_ptl_not_own_fork */
function checkTemplateNotOwnFork(template: EffectiveTemplate, errors: ModuleErrorDetail[]): void {
  if (template.ptlForkedFromId !== null && template.ptlForkedFromId === template.ptlId) {
    errors.push({
      field: 'ptlForkedFromId',
      message: 'A template cannot be forked from itself',
    });
  }
}

/**
 * ck_ptl_fork_pair. Half a provenance record is worse than none: it says the
 * design was cloned but not from which revision, which is the only part that
 * makes the record useful when the shipped original later changes.
 */
function checkTemplateForkPair(template: EffectiveTemplate, errors: ModuleErrorDetail[]): void {
  const hasId = template.ptlForkedFromId !== null;
  const hasRev = template.ptlForkedFromRev !== null;
  if (hasId !== hasRev) {
    errors.push({
      field: hasId ? 'ptlForkedFromRev' : 'ptlForkedFromId',
      message:
        'ptlForkedFromId and ptlForkedFromRev are a pair — send both to record where a clone ' +
        'came from, or neither',
    });
  }
}

/** ck_ptl_sort */
function checkTemplateSortOrder(template: EffectiveTemplate, errors: ModuleErrorDetail[]): void {
  if (!Number.isInteger(template.ptlSortOrder) || template.ptlSortOrder < 0) {
    errors.push({ field: 'ptlSortOrder', message: 'ptlSortOrder must be 0 or more' });
  }
}

export function collectTemplateInvariantErrors(template: EffectiveTemplate): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  checkTemplateCodeShape(template, errors);
  checkTemplateNotOwnFork(template, errors);
  checkTemplateForkPair(template, errors);
  checkTemplateSortOrder(template, errors);
  return errors;
}

// ═══ §3 print_template_version ═════════════════════════════════════════════

export interface EffectiveVersion {
  ptvRevNo: number;
  ptvStatus: string;
  ptvEngine: string;
  ptvBody: string;
  ptvPaperCode: string;
  ptvOrientation: string;
  ptvWidthMm: number | null;
  ptvHeightMm: number | null;
  ptvMarginTopMm: number;
  ptvMarginBottomMm: number;
  ptvMarginLeftMm: number;
  ptvMarginRightMm: number;
  ptvColumns: number | null;
  ptvLang: string;
  ptvParams: unknown;
  ptvApprovedBy: string | null;
}

/** ck_ptv_status */
function checkVersionStatus(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!(PTV_STATUSES as readonly string[]).includes(version.ptvStatus)) {
    errors.push({
      field: at(path, 'ptvStatus'),
      message: `ptvStatus must be one of ${PTV_STATUSES.join(', ')}`,
    });
  }
}

/** ck_ptv_engine */
function checkVersionEngine(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!(PTV_ENGINES as readonly string[]).includes(version.ptvEngine)) {
    errors.push({
      field: at(path, 'ptvEngine'),
      message: `ptvEngine must be one of ${PTV_ENGINES.join(', ')}`,
    });
  }
}

/**
 * ck_ptv_body_is_json + ck_ptv_body_size.
 *
 * The JSON half applies to JSON_BANDS alone — an HTML_CSS or QTRPT_XML body is
 * text and nothing here should read it. "IS JSON OBJECT" is stricter than "is
 * valid JSON": an array, a number and a bare null all parse and none of them is
 * a band document.
 */
function checkVersionBody(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  const length = version.ptvBody.length;
  if (length < PTV_BODY_MIN_LENGTH || length > PTV_BODY_MAX_LENGTH) {
    errors.push({
      field: at(path, 'ptvBody'),
      message: `ptvBody must be between ${PTV_BODY_MIN_LENGTH} and ${PTV_BODY_MAX_LENGTH} characters`,
    });
    return;
  }
  if (version.ptvEngine !== PTV_JSON_ENGINE) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(version.ptvBody);
  } catch {
    errors.push({
      field: at(path, 'ptvBody'),
      message: `ptvBody must be a JSON object when ptvEngine is ${PTV_JSON_ENGINE} — it did not parse as JSON`,
    });
    return;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    errors.push({
      field: at(path, 'ptvBody'),
      message: `ptvBody must be a JSON OBJECT when ptvEngine is ${PTV_JSON_ENGINE} — an array, a number or null will not do`,
    });
  }
}

/** ck_ptv_rev_no */
function checkVersionRevNo(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!Number.isInteger(version.ptvRevNo) || version.ptvRevNo <= 0) {
    errors.push({
      field: at(path, 'ptvRevNo'),
      message: 'ptvRevNo must be a positive integer',
    });
  }
}

/** ck_ptv_orientation */
function checkVersionOrientation(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!(PTV_ORIENTATIONS as readonly string[]).includes(version.ptvOrientation)) {
    errors.push({
      field: at(path, 'ptvOrientation'),
      message: `ptvOrientation must be one of ${PTV_ORIENTATIONS.join(', ')}`,
    });
  }
}

/**
 * ck_ptv_geometry, as four separate messages rather than one.
 *
 * The constraint is a single conjunction, so the database can only say "the
 * geometry is wrong". Which of six numbers it means is exactly what the author
 * needs to know.
 */
function checkVersionGeometry(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (version.ptvWidthMm !== null && !(version.ptvWidthMm > 0)) {
    errors.push({
      field: at(path, 'ptvWidthMm'),
      message: 'ptvWidthMm must be greater than 0, or null to take it from the paper',
    });
  }
  if (version.ptvHeightMm !== null && !(version.ptvHeightMm > 0)) {
    errors.push({
      field: at(path, 'ptvHeightMm'),
      message: 'ptvHeightMm must be greater than 0, or null to take it from the paper',
    });
  }
  const margins: Array<[string, number]> = [
    ['ptvMarginTopMm', version.ptvMarginTopMm],
    ['ptvMarginBottomMm', version.ptvMarginBottomMm],
    ['ptvMarginLeftMm', version.ptvMarginLeftMm],
    ['ptvMarginRightMm', version.ptvMarginRightMm],
  ];
  for (const [field, value] of margins) {
    if (!(value >= 0)) {
      errors.push({ field: at(path, field), message: `${field} must be 0 or more` });
    }
  }
  if (
    version.ptvColumns !== null &&
    (!Number.isInteger(version.ptvColumns) ||
      version.ptvColumns < PTV_COLUMNS_MIN ||
      version.ptvColumns > PTV_COLUMNS_MAX)
  ) {
    errors.push({
      field: at(path, 'ptvColumns'),
      message:
        `ptvColumns must be between ${PTV_COLUMNS_MIN} and ${PTV_COLUMNS_MAX}, or null for a ` +
        'page engine where characters per line mean nothing',
    });
  }
}

/**
 * ck_ptv_published. Publishing needs a signature, exactly as ck_prm_approved
 * requires one before a promotion may give money away — and for the same
 * reason: a version whose datasets carry stored SQL is, in every meaningful
 * sense, code.
 */
function checkVersionPublished(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (version.ptvStatus === 'PUBLISHED' && !version.ptvApprovedBy) {
    errors.push({
      field: at(path, 'ptvApprovedBy'),
      message: 'A PUBLISHED version must name its approver in ptvApprovedBy',
    });
  }
}

/** ck_ptv_lang_shape */
function checkVersionLang(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!PTV_LANG_PATTERN.test(version.ptvLang)) {
    errors.push({
      field: at(path, 'ptvLang'),
      message: 'ptvLang must look like "en" or "en-IN" — two lower-case letters, optional -REGION',
    });
  }
}

/**
 * ck_ptv_params_is_array, plus the entry shape the column's documentation
 * defines and no constraint can.
 *
 * The prompts are declared ON THE VERSION because the operator is asked ONCE.
 * ANY name may be declared, including a context one: `ptv_params` is the whole
 * declaration, and an author who wants `:doc_id` to come from the operator
 * rather than from the print request says so by putting a row here. The context
 * names remain a FALLBACK for what a revision does not declare — see
 * PTV_CONTEXT_PARAMS — so nothing written before this change has to be edited.
 *
 * The only thing still refused is a second row for a name already declared:
 * the operator is asked once, and two rows have no answer to which type the
 * screen should use.
 */
function checkVersionParams(
  version: EffectiveVersion,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  const params = version.ptvParams;
  if (params === null || params === undefined) {
    return;
  }
  if (!Array.isArray(params)) {
    errors.push({
      field: at(path, 'ptvParams'),
      message: 'ptvParams must be a JSON array of prompt declarations, or null',
    });
    return;
  }

  const seen = new Map<string, number>();
  params.forEach((entry, index) => {
    const field = at(path, `ptvParams[${index}]`);
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push({ field, message: 'Each ptvParams entry must be an object' });
      return;
    }
    const record = entry as Record<string, unknown>;
    const name = record.name;
    if (typeof name !== 'string' || !PTV_PARAM_NAME_PATTERN.test(name)) {
      errors.push({
        field: `${field}.name`,
        message: 'name must be lower snake case, starting with a letter — it is what :name binds',
      });
    } else {
      const first = seen.get(name);
      if (first !== undefined) {
        errors.push({
          field: `${field}.name`,
          message: `Prompts ${first + 1} and ${index + 1} both declare "${name}"`,
        });
      }
      seen.set(name, index);
    }
    if (
      record.type !== undefined &&
      (typeof record.type !== 'string' ||
        !(PTV_PARAM_TYPES as readonly string[]).includes(record.type))
    ) {
      errors.push({
        field: `${field}.type`,
        message: `type must be one of ${PTV_PARAM_TYPES.join(', ')}`,
      });
    }
    if (record.required !== undefined && typeof record.required !== 'boolean') {
      errors.push({ field: `${field}.required`, message: 'required must be true or false' });
    }
    if (record.label !== undefined && typeof record.label !== 'string') {
      errors.push({ field: `${field}.label`, message: 'label must be a string' });
    }
  });
}

export function collectVersionInvariantErrors(
  version: EffectiveVersion,
  path = '',
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  checkVersionStatus(version, path, errors);
  checkVersionEngine(version, path, errors);
  checkVersionBody(version, path, errors);
  checkVersionRevNo(version, path, errors);
  checkVersionOrientation(version, path, errors);
  checkVersionGeometry(version, path, errors);
  checkVersionPublished(version, path, errors);
  checkVersionLang(version, path, errors);
  checkVersionParams(version, path, errors);
  return errors;
}

// ═══ §4 print_template_dataset ═════════════════════════════════════════════

export interface EffectiveDataset {
  ptdRole: string;
  ptdDatasetNo: number;
  ptdName: string;
  ptdSourceKind: string;
  ptdProviderCode: string | null;
  ptdSql: string | null;
  ptdRequiresCompany: boolean;
  ptdParentNo: number | null;
  ptdLinkFields: string | null;
  ptdRowLimit: number;
  ptdTimeoutMs: number;
}

/** ck_ptd_role */
function checkDatasetRole(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!(PTD_ROLES as readonly string[]).includes(dataset.ptdRole)) {
    errors.push({
      field: at(path, 'ptdRole'),
      message: `ptdRole must be one of ${PTD_ROLES.join(', ')}`,
    });
  }
}

/** ck_ptd_source_kind */
function checkDatasetSourceKind(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!(PTD_SOURCE_KINDS as readonly string[]).includes(dataset.ptdSourceKind)) {
    errors.push({
      field: at(path, 'ptdSourceKind'),
      message: `ptdSourceKind must be one of ${PTD_SOURCE_KINDS.join(', ')}`,
    });
  }
}

/**
 * ck_ptd_source_biconditional — two biconditionals which together already
 * forbid both-set and neither-set, so there is no third rule to write.
 */
function checkDatasetSourceBiconditional(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  const isProvider = dataset.ptdSourceKind === 'PROVIDER';
  const isSql = dataset.ptdSourceKind === 'SQL';
  if (isProvider !== (dataset.ptdProviderCode !== null)) {
    errors.push({
      field: at(path, 'ptdProviderCode'),
      message: isProvider
        ? 'A PROVIDER dataset must name ptdProviderCode'
        : 'ptdProviderCode belongs to a PROVIDER dataset — clear it or set ptdSourceKind to PROVIDER',
    });
  }
  if (isSql !== (dataset.ptdSql !== null)) {
    errors.push({
      field: at(path, 'ptdSql'),
      message: isSql
        ? 'A SQL dataset must carry ptdSql'
        : 'ptdSql belongs to a SQL dataset — clear it or set ptdSourceKind to SQL',
    });
  }
}

/**
 * ck_ptd_master_is_zero — THE 3.0 FIX. The master is dataset 0, and nothing
 * else is. 3.0's pssql_slno was both the display order and the DataSet index at
 * once, so reordering rows in the editor rebound every band to the wrong query,
 * with no error and no visible cause.
 */
function checkDatasetMasterIsZero(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  const isMaster = dataset.ptdRole === 'MASTER';
  const isZero = dataset.ptdDatasetNo === PTD_MASTER_DATASET_NO;
  if (isMaster !== isZero) {
    errors.push({
      field: at(path, 'ptdDatasetNo'),
      message: isMaster
        ? `The MASTER dataset must be number ${PTD_MASTER_DATASET_NO}`
        : `Dataset number ${PTD_MASTER_DATASET_NO} is reserved for the MASTER — number a DETAIL from 1`,
    });
  }
}

/** ck_ptd_dataset_no */
function checkDatasetNoRange(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (
    !Number.isInteger(dataset.ptdDatasetNo) ||
    dataset.ptdDatasetNo < PTD_DATASET_NO_MIN ||
    dataset.ptdDatasetNo > PTD_DATASET_NO_MAX
  ) {
    errors.push({
      field: at(path, 'ptdDatasetNo'),
      message: `ptdDatasetNo must be between ${PTD_DATASET_NO_MIN} and ${PTD_DATASET_NO_MAX}`,
    });
  }
}

/** ck_ptd_name_shape — the binding by name, so a later engine can address
 *  'items' rather than 2. */
function checkDatasetNameShape(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (!PTD_NAME_PATTERN.test(dataset.ptdName)) {
    errors.push({
      field: at(path, 'ptdName'),
      message: 'ptdName must be lower snake case, starting with a letter — "items", "bill_header"',
    });
  }
}

/** ck_ptd_provider_shape */
function checkDatasetProviderShape(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (dataset.ptdProviderCode !== null && !PTD_PROVIDER_PATTERN.test(dataset.ptdProviderCode)) {
    errors.push({
      field: at(path, 'ptdProviderCode'),
      message: 'ptdProviderCode must be dotted lower snake case — "sales.bill.tax_summary"',
    });
  }
}

/** ck_ptd_parent — no self-parent, and a MASTER may not have one. */
function checkDatasetParent(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (dataset.ptdParentNo === null) {
    return;
  }
  if (dataset.ptdParentNo === dataset.ptdDatasetNo) {
    errors.push({
      field: at(path, 'ptdParentNo'),
      message: 'A dataset cannot be its own parent',
    });
  }
  if (dataset.ptdRole === 'MASTER') {
    errors.push({
      field: at(path, 'ptdParentNo'),
      message: 'The MASTER dataset is the header context and has no parent',
    });
  }
}

/** ck_ptd_parent_pair + ck_ptd_link_fields_shape */
function checkDatasetLinkFields(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  const hasParent = dataset.ptdParentNo !== null;
  const hasLink = dataset.ptdLinkFields !== null;
  if (hasParent !== hasLink) {
    errors.push({
      field: hasParent ? at(path, 'ptdLinkFields') : at(path, 'ptdParentNo'),
      message:
        'ptdParentNo and ptdLinkFields are a pair — a nested dataset must say WHICH dataset it ' +
        'hangs off and HOW the rows match',
    });
  }
  if (dataset.ptdLinkFields !== null && !PTD_LINK_FIELDS_PATTERN.test(dataset.ptdLinkFields)) {
    errors.push({
      field: at(path, 'ptdLinkFields'),
      message:
        'ptdLinkFields must be parent=child pairs, comma separated, no spaces — ' +
        '"sbi_id=line_id" or "sb_id=bill_id,sbi_slno=slno". Both sides are output columns; ' +
        'neither is a bound parameter.',
    });
  }
}

/**
 * ck_ptd_limits. Both numbers measure THE WHOLE BAND: the child query runs once
 * for the whole render, not once per parent row, so a 14-line bill costs one
 * query and one timeout, not fifteen.
 */
function checkDatasetLimits(
  dataset: EffectiveDataset,
  path: string,
  errors: ModuleErrorDetail[],
): void {
  if (
    !Number.isInteger(dataset.ptdRowLimit) ||
    dataset.ptdRowLimit < PTD_ROW_LIMIT_MIN ||
    dataset.ptdRowLimit > PTD_ROW_LIMIT_MAX
  ) {
    errors.push({
      field: at(path, 'ptdRowLimit'),
      message: `ptdRowLimit must be between ${PTD_ROW_LIMIT_MIN} and ${PTD_ROW_LIMIT_MAX}`,
    });
  }
  if (
    !Number.isInteger(dataset.ptdTimeoutMs) ||
    dataset.ptdTimeoutMs < PTD_TIMEOUT_MS_MIN ||
    dataset.ptdTimeoutMs > PTD_TIMEOUT_MS_MAX
  ) {
    errors.push({
      field: at(path, 'ptdTimeoutMs'),
      message: `ptdTimeoutMs must be between ${PTD_TIMEOUT_MS_MIN} and ${PTD_TIMEOUT_MS_MAX} ms`,
    });
  }
}

export function collectDatasetInvariantErrors(
  dataset: EffectiveDataset,
  path = '',
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  checkDatasetRole(dataset, path, errors);
  checkDatasetSourceKind(dataset, path, errors);
  checkDatasetSourceBiconditional(dataset, path, errors);
  checkDatasetMasterIsZero(dataset, path, errors);
  checkDatasetNoRange(dataset, path, errors);
  checkDatasetNameShape(dataset, path, errors);
  checkDatasetProviderShape(dataset, path, errors);
  checkDatasetParent(dataset, path, errors);
  checkDatasetLinkFields(dataset, path, errors);
  checkDatasetLimits(dataset, path, errors);
  if (dataset.ptdSourceKind === 'SQL' && dataset.ptdSql !== null) {
    errors.push(
      ...collectDatasetSqlErrors(dataset.ptdSql, dataset.ptdRequiresCompany, at(path, 'ptdSql')),
    );
  }
  return errors;
}

/**
 * What no single row can see: the three partial unique indexes, and the fact
 * that a parent number has to name a dataset that exists.
 *
 * Partial indexes are why this is here rather than left to the database —
 * Prisma neither declares nor necessarily creates ux_ptd_dataset_no,
 * ux_ptd_name or ux_ptd_one_master, and a P2002 would in any case not say which
 * two rows collided.
 *
 * `datasets` is the WHOLE set the version will hold once this request is
 * applied, not just the rows that changed.
 */
export function collectDatasetSetInvariantErrors(
  datasets: Array<{ dataset: EffectiveDataset; path: string }>,
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  const byNumber = new Map<number, number>();
  const byName = new Map<string, number>();
  const masters: number[] = [];

  datasets.forEach(({ dataset, path }, index) => {
    // ux_ptd_dataset_no — THE BINDING. Two rows claiming one number is the bug
    // that silently rebinds a band to the wrong query.
    const clashNumber = byNumber.get(dataset.ptdDatasetNo);
    if (clashNumber !== undefined) {
      errors.push({
        field: at(path, 'ptdDatasetNo'),
        message: `Datasets ${clashNumber + 1} and ${index + 1} both claim number ${dataset.ptdDatasetNo}`,
      });
    } else {
      byNumber.set(dataset.ptdDatasetNo, index);
    }

    // ux_ptd_name
    const clashName = byName.get(dataset.ptdName);
    if (clashName !== undefined) {
      errors.push({
        field: at(path, 'ptdName'),
        message: `Datasets ${clashName + 1} and ${index + 1} are both named "${dataset.ptdName}"`,
      });
    } else {
      byName.set(dataset.ptdName, index);
    }

    if (dataset.ptdRole === 'MASTER') {
      masters.push(index);
    }
  });

  // ux_ptd_one_master. Zero is allowed by the index and by this check: a
  // version may legitimately be all-DETAIL — a report with no header context —
  // and refusing that would be a rule the database does not have.
  if (masters.length > 1) {
    const [, second] = masters;
    errors.push({
      field: at(datasets[second].path, 'ptdRole'),
      message: `A version may hold at most one MASTER dataset; rows ${masters
        .map((index) => index + 1)
        .join(', ')} all claim it`,
    });
  }

  // A parent number that names nothing is not a CHECK — a constraint cannot
  // look at another row — but it is a template that renders empty bands.
  datasets.forEach(({ dataset, path }) => {
    if (dataset.ptdParentNo !== null && !byNumber.has(dataset.ptdParentNo)) {
      errors.push({
        field: at(path, 'ptdParentNo'),
        message: `No dataset in this version is numbered ${dataset.ptdParentNo}`,
      });
    }
  });

  errors.push(...collectParentCycleErrors(datasets, byNumber));
  return errors;
}

/**
 * Nesting must be a tree. Two datasets naming each other as parent satisfies
 * every per-row rule and every unique index, and hangs the renderer.
 */
function collectParentCycleErrors(
  datasets: Array<{ dataset: EffectiveDataset; path: string }>,
  byNumber: Map<number, number>,
): ModuleErrorDetail[] {
  const errors: ModuleErrorDetail[] = [];
  datasets.forEach(({ dataset, path }) => {
    const seen = new Set<number>([dataset.ptdDatasetNo]);
    let parentNo = dataset.ptdParentNo;
    while (parentNo !== null && parentNo !== undefined) {
      if (seen.has(parentNo)) {
        errors.push({
          field: at(path, 'ptdParentNo'),
          message: `Dataset "${dataset.ptdName}" is nested inside itself through dataset ${parentNo}`,
        });
        return;
      }
      seen.add(parentNo);
      const index = byNumber.get(parentNo);
      if (index === undefined) {
        return; // already reported as a dangling parent
      }
      parentNo = datasets[index].dataset.ptdParentNo;
    }
  });
  return errors;
}
