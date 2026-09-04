export type { SettingsErrorDetail as PrintTemplateErrorDetail } from 'src/common/types/module-api.types';
export type { SettingsErrorResponse as PrintTemplateErrorResponse } from 'src/common/types/module-api.types';
export type { SettingsSuccessResponse as PrintTemplateSuccessResponse } from 'src/common/types/module-api.types';

/**
 * §4 — where the rows come from. Hangs off the VERSION, not the template: a
 * dataset is part of the report definition, not a setting beside it.
 */
export interface PrintTemplateDatasetPayload {
  ptdId: string;
  ptdVersionId: string;
  ptdRole: string;
  /// THE BINDING — what a band actually points at. The master is always 0.
  ptdDatasetNo: number;
  /// Display order in the designer. Binds nothing. Safe to reorder.
  ptdSortOrder: number;
  ptdName: string;
  ptdLabel: string | null;
  ptdSourceKind: string;
  ptdProviderCode: string | null;
  ptdSql: string | null;
  /// GENERATED ALWAYS ... STORED, read-only. Returned because every SQL guard
  /// reads this and not ptdSql, so it is the text an author needs to see when
  /// a guard refuses a query that looks fine.
  ptdSqlNorm: string | null;
  ptdRequiresCompany: boolean;
  ptdParentNo: number | null;
  ptdLinkFields: string | null;
  ptdRowLimit: number;
  ptdTimeoutMs: number;
  ptdRemarks: string | null;
  ptdIsDeleted: boolean;
  ptdSyncDate: string | null;
  ptdCreatedOn: string;
  ptdCreatedBy: string | null;
  ptdModifiedOn: string | null;
  ptdModifiedBy: string | null;
}

/**
 * §3 — the design itself, frozen once published. THE BODY LIVES HERE, which is
 * what makes print_log.plg_version_id a real reference to the exact bytes that
 * were rendered.
 */
export interface PrintTemplateVersionPayload {
  ptvId: string;
  ptvTemplateId: string;
  ptvRevNo: number;
  ptvStatus: string;
  ptvEngine: string;
  ptvBody: string;
  ptvSchemaVer: number;
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
  ptvFontFamily: string | null;
  /// What the OPERATOR is asked, once, for the whole render. Context
  /// parameters are never in here — the server finds those by reading the query.
  ptvParams: unknown;
  ptvNote: string | null;
  ptvApprovedOn: string | null;
  ptvApprovedBy: string | null;
  ptvIsDeleted: boolean;
  ptvSyncDate: string | null;
  ptvCreatedOn: string;
  ptvCreatedBy: string | null;
  ptvModifiedOn: string | null;
  ptvModifiedBy: string | null;
  /// Derived: is this the revision ptl_published_rev_id currently names? The
  /// answer a designer needs before editing, since a published version is never
  /// UPDATEd.
  ptvIsPublishedRev: boolean;
  /// Derived: may this version still be edited? DRAFT and nothing else.
  ptvIsEditable: boolean;
  datasets: PrintTemplateDatasetPayload[];
}

/**
 * §2 — the design's IDENTITY, and nothing else: a name, an owner, and a pointer
 * to the revision that is currently published.
 *
 * It carries NO branch, NO device and NO isDefault. Every one of those is a
 * RESOLUTION question and belongs to PrintTemplateAssignment.
 */
export interface PrintTemplatePayload {
  ptlId: string;
  /// NULL = shipped with the product.
  ptlCompanyId: string | null;
  ptlCompanyName: string | null;
  ptlPurposeId: string;
  ptlPurposeCode: string | null;
  ptlPurposeName: string | null;
  ptlCode: string;
  ptlName: string;
  ptlDescription: string | null;
  /// The revision a render actually uses. NULL until something is published,
  /// which is why a template with only a draft simply does not resolve.
  ptlPublishedRevId: string | null;
  ptlPublishedRevNo: number | null;
  ptlForkedFromId: string | null;
  ptlForkedFromCode: string | null;
  ptlForkedFromRev: number | null;
  ptlSortOrder: number;
  /// GENERATED ALWAYS ... STORED, read-only: the owner with NULL folded to the
  /// nil uuid, so that §5's composite fk_pta_template can point at (id, owner).
  ptlCompanyKey: string | null;
  ptlIsActive: boolean;
  ptlIsDeleted: boolean;
  ptlSyncDate: string | null;
  ptlCreatedOn: string;
  ptlCreatedBy: string | null;
  ptlModifiedOn: string | null;
  ptlModifiedBy: string | null;
  versions: PrintTemplateVersionPayload[];
}

export interface PrintTemplateListResult {
  items: PrintTemplatePayload[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PrintTemplateDeleteResult {
  deleted: true;
  ptlId: string;
}
