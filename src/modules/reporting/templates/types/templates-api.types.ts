import { TemplateDefinition } from '../dto/template-definition.schema';

/**
 * The templates API's response shapes.
 *
 * Follows the module convention: `{ success, message, data, meta }`, with the
 * payload types declared here rather than inferred, so a Swagger DTO and the
 * service cannot drift apart silently.
 */

export interface TemplatesSuccessResponse<TData, TMeta = undefined> {
  success: true;
  message: string;
  data: TData;
  meta?: TMeta;
}

/** A template row without its definition — what a list needs. */
export interface TemplateSummaryPayload {
  ptId: string;
  ptCompanyId: string | null;
  ptBranchId: string | null;
  ptDocType: string;
  ptOutputMode: string;
  ptPaperCode: string;
  ptName: string;
  ptVersion: number;
  ptParentId: string | null;
  ptSchemaVer: number;
  ptIsDefault: boolean;
  ptIsActive: boolean;
  /** True when ptCompanyId is null — a shipped design that must be cloned to edit. */
  isSystemTemplate: boolean;
  ptCreatedOn: string;
  ptCreatedBy: string | null;
  ptModifiedOn: string | null;
  ptModifiedBy: string | null;
}

/** A template row with its definition, migrated to the current schema. */
export interface TemplatePayload extends TemplateSummaryPayload {
  definition: TemplateDefinition;
  /** True when the stored JSON was at an older schema version and was upgraded. */
  definitionMigrated: boolean;
}

export interface TemplateRevisionPayload {
  ptrId: string;
  ptrTemplateId: string;
  ptrVersion: number;
  ptrSchemaVer: number;
  ptrNote: string | null;
  ptrCreatedOn: string;
  ptrCreatedBy: string | null;
}

export interface TemplateListMeta {
  count: number;
  docType?: string;
  outputMode?: string;
  paperCode?: string;
  companyId?: string;
  includeSystem: boolean;
}

/** The exported/importable file format. */
export interface TemplateExportPayload {
  /** Format marker, so an import can reject an unrelated JSON file outright. */
  kind: 'vknex.print-template';
  exportVersion: 1;
  exportedAt: string;
  name: string;
  docType: string;
  outputMode: string;
  paperCode: string;
  schemaVersion: number;
  definition: TemplateDefinition;
}

export interface TemplateDeleteResult {
  ptId: string;
  deleted: boolean;
}

/** Where a print request's template came from, for the response header and log. */
export type TemplateResolutionSource =
  | 'EXPLICIT'
  | 'BRANCH_DEFAULT'
  | 'COMPANY_DEFAULT'
  | 'SYSTEM_DEFAULT';

export interface ResolvedTemplate {
  ptId: string;
  name: string;
  version: number;
  outputMode: string;
  paperCode: string;
  definition: TemplateDefinition;
  source: TemplateResolutionSource;
}
