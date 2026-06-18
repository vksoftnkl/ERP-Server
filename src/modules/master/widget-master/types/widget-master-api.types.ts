import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from 'src/common/types/module-api.types';

export type WidgetMasterErrorDetail = ModuleApiErrorDetail;
export type WidgetMasterErrorResponse = ModuleApiErrorResponse<WidgetMasterErrorDetail>;
export type WidgetMasterSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;

/**
 * Platform scope for a form section. The DB column is now a free `varchar(255)`,
 * but the API keeps validating against the known platforms (previously the
 * `WidgetPlatform` Prisma enum) so the contract is unchanged.
 */
export enum WidgetPlatform {
  Mobile = 'Mobile',
  Desktop = 'Desktop',
  Web = 'Web',
}

/** One field row under a section ("field" in `fixed.form_field`). */
export interface WidgetFieldPayload {
  fieldId: number;
  fieldSectionId: number;
  fieldName: string;
  fieldGuiName: string | null;
  fieldSecondaryText: string | null;
  fieldPosition: number;
  fieldVisibility: boolean;
  fieldSyncDate: string;
  fieldCreatedOn: string;
  fieldCreatedBy: string | null;
  fieldUpdatedOn: string;
  fieldUpdatedBy: string | null;
}

/** A section heading row ("section" in `fixed.form_section`) with its nested fields. */
export interface WidgetMasterPayload {
  sectionId: number;
  sectionMenuId: number;
  sectionName: string;
  sectionGuiName: string;
  sectionPosition: number;
  sectionVisibility: boolean;
  sectionPlatform: WidgetPlatform;
  sectionSyncDate: string;
  sectionCreatedOn: string;
  sectionCreatedBy: string | null;
  sectionUpdatedOn: string;
  sectionUpdatedBy: string | null;
  fields: WidgetFieldPayload[];
}
