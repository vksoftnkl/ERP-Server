import { Prisma } from '@prisma/client';
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  PrintTemplateDatasetPayload,
  PrintTemplatePayload,
  PrintTemplateVersionPayload,
} from '../types/print-template-api.types';

// ─── What a read pulls back ────────────────────────────────────────────────

/**
 * Display order in the designer, then the binding, then the id as a
 * tie-break. ptd_sort_order binds nothing, which is exactly why it is safe to
 * sort by: reordering the grid cannot move a band's data out from under it.
 */
export const DATASET_ORDER_BY: Prisma.PrintTemplateDatasetOrderByWithRelationInput[] = [
  { ptdSortOrder: 'asc' },
  { ptdDatasetNo: 'asc' },
  { ptdId: 'asc' },
];

export const VERSION_INCLUDE = {
  datasets: {
    where: { ptdIsDeleted: false },
    orderBy: DATASET_ORDER_BY,
  },
} satisfies Prisma.PrintTemplateVersionInclude;

/**
 * Newest revision first. A designer opening a template wants the draft they
 * were working on, not rev 1 from two years ago.
 */
export const TEMPLATE_INCLUDE = {
  company: { select: { compName: true } },
  purpose: { select: { ppoCode: true, ppoName: true } },
  forkedFrom: { select: { ptlCode: true } },
  publishedRev: { select: { ptvRevNo: true } },
  versions: {
    where: { ptvIsDeleted: false },
    orderBy: { ptvRevNo: 'desc' },
    include: VERSION_INCLUDE,
  },
} satisfies Prisma.PrintTemplateInclude;

export type TemplateWithChildren = Prisma.PrintTemplateGetPayload<{
  include: typeof TEMPLATE_INCLUDE;
}>;

export type VersionWithDatasets = Prisma.PrintTemplateVersionGetPayload<{
  include: typeof VERSION_INCLUDE;
}>;

export type DatasetRow = Prisma.PrintTemplateDatasetGetPayload<Record<string, never>>;
export type VersionRow = Prisma.PrintTemplateVersionGetPayload<Record<string, never>>;
export type TemplateRow = Prisma.PrintTemplateGetPayload<Record<string, never>>;

// ─── Row → payload ─────────────────────────────────────────────────────────

const toIso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

export function toDatasetPayload(row: DatasetRow): PrintTemplateDatasetPayload {
  return {
    ptdId: row.ptdId,
    ptdVersionId: row.ptdVersionId,
    ptdRole: row.ptdRole,
    ptdDatasetNo: row.ptdDatasetNo,
    ptdSortOrder: row.ptdSortOrder,
    ptdName: row.ptdName,
    ptdLabel: row.ptdLabel,
    ptdSourceKind: row.ptdSourceKind,
    ptdProviderCode: row.ptdProviderCode,
    ptdSql: row.ptdSql,
    ptdSqlNorm: row.ptdSqlNorm,
    ptdRequiresCompany: row.ptdRequiresCompany,
    ptdParentNo: row.ptdParentNo,
    ptdLinkFields: row.ptdLinkFields,
    ptdRowLimit: row.ptdRowLimit,
    ptdTimeoutMs: row.ptdTimeoutMs,
    ptdRemarks: row.ptdRemarks,
    ptdIsDeleted: row.ptdIsDeleted,
    ptdSyncDate: toIso(row.ptdSyncDate),
    ptdCreatedOn: row.ptdCreatedOn.toISOString(),
    ptdCreatedBy: row.ptdCreatedBy,
    ptdModifiedOn: toIso(row.ptdModifiedOn),
    ptdModifiedBy: row.ptdModifiedBy,
  };
}

/**
 * `publishedRevId` is the template's pointer, passed in rather than read from
 * the row: a version does not know whether it is the published one, and the
 * whole point of §3 is that publishing is a pointer move on the OTHER table.
 */
export function toVersionPayload(
  row: VersionRow & { datasets?: DatasetRow[] },
  publishedRevId: string | null,
): PrintTemplateVersionPayload {
  return {
    ptvId: row.ptvId,
    ptvTemplateId: row.ptvTemplateId,
    ptvRevNo: row.ptvRevNo,
    ptvStatus: row.ptvStatus,
    ptvEngine: row.ptvEngine,
    ptvBody: row.ptvBody,
    ptvSchemaVer: row.ptvSchemaVer,
    ptvPaperCode: row.ptvPaperCode,
    ptvOrientation: row.ptvOrientation,
    ptvWidthMm: toNullableNumber(row.ptvWidthMm),
    ptvHeightMm: toNullableNumber(row.ptvHeightMm),
    ptvMarginTopMm: toNumber(row.ptvMarginTopMm),
    ptvMarginBottomMm: toNumber(row.ptvMarginBottomMm),
    ptvMarginLeftMm: toNumber(row.ptvMarginLeftMm),
    ptvMarginRightMm: toNumber(row.ptvMarginRightMm),
    ptvColumns: row.ptvColumns,
    ptvLang: row.ptvLang,
    ptvFontFamily: row.ptvFontFamily,
    ptvParams: row.ptvParams ?? null,
    ptvNote: row.ptvNote,
    ptvApprovedOn: toIso(row.ptvApprovedOn),
    ptvApprovedBy: row.ptvApprovedBy,
    ptvIsDeleted: row.ptvIsDeleted,
    ptvSyncDate: toIso(row.ptvSyncDate),
    ptvCreatedOn: row.ptvCreatedOn.toISOString(),
    ptvCreatedBy: row.ptvCreatedBy,
    ptvModifiedOn: toIso(row.ptvModifiedOn),
    ptvModifiedBy: row.ptvModifiedBy,
    ptvIsPublishedRev: publishedRevId !== null && publishedRevId === row.ptvId,
    ptvIsEditable: row.ptvStatus === 'DRAFT',
    datasets: (row.datasets ?? []).map(toDatasetPayload),
  };
}

export function toTemplatePayload(
  row: TemplateRow & Partial<Omit<TemplateWithChildren, keyof TemplateRow>>,
): PrintTemplatePayload {
  return {
    ptlId: row.ptlId,
    ptlCompanyId: row.ptlCompanyId,
    ptlCompanyName: row.company?.compName ?? null,
    ptlPurposeId: row.ptlPurposeId,
    ptlPurposeCode: row.purpose?.ppoCode ?? null,
    ptlPurposeName: row.purpose?.ppoName ?? null,
    ptlCode: row.ptlCode,
    ptlName: row.ptlName,
    ptlDescription: row.ptlDescription,
    ptlPublishedRevId: row.ptlPublishedRevId,
    ptlPublishedRevNo: row.publishedRev?.ptvRevNo ?? null,
    ptlForkedFromId: row.ptlForkedFromId,
    ptlForkedFromCode: row.forkedFrom?.ptlCode ?? null,
    ptlForkedFromRev: row.ptlForkedFromRev,
    ptlSortOrder: row.ptlSortOrder,
    ptlCompanyKey: row.ptlCompanyKey,
    ptlIsActive: row.ptlIsActive,
    ptlIsDeleted: row.ptlIsDeleted,
    ptlSyncDate: toIso(row.ptlSyncDate),
    ptlCreatedOn: row.ptlCreatedOn.toISOString(),
    ptlCreatedBy: row.ptlCreatedBy,
    ptlModifiedOn: toIso(row.ptlModifiedOn),
    ptlModifiedBy: row.ptlModifiedBy,
    versions: (row.versions ?? []).map((version) =>
      toVersionPayload(version, row.ptlPublishedRevId),
    ),
  };
}

// ─── Write errors ──────────────────────────────────────────────────────────

/**
 * The last line of defence, for the constraints the service checked first and
 * a concurrent request could still trip between the check and the INSERT.
 *
 * Every unique index in §2–§4 is PARTIAL, so Prisma neither declares nor
 * necessarily creates them and a P2002 arrives with the raw constraint name
 * rather than a field. Naming them here is what turns "unique constraint failed
 * on the fields: (ptv_template_id, ptv_rev_no)" into a sentence about revision
 * numbers.
 */
export function handlePrintTemplateWriteError(error: unknown): void {
  if (isUniqueConstraintError(error)) {
    const target = describeUniqueTarget(error);
    throwSettingsConflict(target.message, [{ field: target.field, message: target.detail }]);
    return;
  }
  if (isForeignKeyConstraintError(error)) {
    throwSettingsBadRequest('Validation failed', [
      {
        field: resolveForeignKeyField(error),
        message: 'Referenced record was not found, or is still in use by another row',
      },
    ]);
    return;
  }
  // A CHECK the service did not reproduce, or reproduced wrongly. 23514 has no
  // Prisma code, so it arrives as an unknown-request error with the constraint
  // name buried in the driver message — which is still far more useful than
  // "Internal server error".
  const constraint = matchCheckConstraint(error);
  if (constraint) {
    throwSettingsBadRequest('Validation failed', [
      {
        field: fieldForConstraint(constraint),
        message: `The database refused this row: ${constraint}. See the printing schema notes for what it enforces.`,
      },
    ]);
  }
}

interface UniqueTarget {
  field: string;
  message: string;
  detail: string;
}

function describeUniqueTarget(error: unknown): UniqueTarget {
  const target = uniqueTargetText(error);
  if (target.includes('ptv_rev_no') || target.includes('ptvRevNo')) {
    return {
      field: 'ptvRevNo',
      message: 'Duplicate revision number',
      detail:
        'This template already has a version with that ptvRevNo. Revision numbers are dense, ' +
        'unique and never reused — omit ptvRevNo and the next one is assigned.',
    };
  }
  if (target.includes('ptd_dataset_no') || target.includes('ptdDatasetNo')) {
    return {
      field: 'ptdDatasetNo',
      message: 'Duplicate dataset number',
      detail: 'Another dataset on this version already claims that number',
    };
  }
  if (target.includes('ptd_name') || target.includes('ptdName')) {
    return {
      field: 'ptdName',
      message: 'Duplicate dataset name',
      detail: 'Another dataset on this version already has that name',
    };
  }
  if (target.includes('ptd_role') || target.includes('one_master')) {
    return {
      field: 'ptdRole',
      message: 'Duplicate MASTER dataset',
      detail: 'A version may hold at most one MASTER dataset',
    };
  }
  if (target.includes('ptl_code') || target.includes('ptlCode')) {
    return {
      field: 'ptlCode',
      message: 'Duplicate template code',
      detail: 'A template with that code already exists for this owner',
    };
  }
  return {
    field: 'request',
    message: 'Duplicate print template data is not allowed',
    detail: 'A record with the same unique values already exists',
  };
}

function uniqueTargetText(error: unknown): string {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return '';
  }
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) {
    return target.join(',');
  }
  if (typeof target === 'string') {
    return target;
  }
  return error.message;
}

function resolveForeignKeyField(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const known: Array<[RegExp, string]> = [
    [/fk_ptl_company|ptl_company_id/, 'ptlCompanyId'],
    [/fk_ptl_purpose|ptl_purpose_id/, 'ptlPurposeId'],
    [/fk_ptl_forked_from|ptl_forked_from_id/, 'ptlForkedFromId'],
    [/fk_ptl_published_rev|ptl_published_rev_id/, 'ptlPublishedRevId'],
    [/fk_ptv_template|ptv_template_id/, 'ptvTemplateId'],
    [/fk_ptv_approved_by|ptv_approved_by/, 'ptvApprovedBy'],
    [/fk_ptd_version|ptd_version_id/, 'ptdVersionId'],
  ];
  for (const [pattern, field] of known) {
    if (pattern.test(text)) {
      return field;
    }
  }
  return 'request';
}

function matchCheckConstraint(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error);
  return text.match(/\bck_pt[dlv]_[a-z0-9_]+/)?.[0] ?? null;
}

function fieldForConstraint(constraint: string): string {
  if (constraint.startsWith('ck_ptl_')) return 'ptlCode';
  if (constraint.startsWith('ck_ptv_')) return 'ptvBody';
  if (constraint.startsWith('ck_ptd_sql')) return 'ptdSql';
  if (constraint.startsWith('ck_ptd_')) return 'ptdName';
  return 'request';
}
