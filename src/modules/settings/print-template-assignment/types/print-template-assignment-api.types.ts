import type { PtaPrinterSource, PtaScope } from '../print-template-assignment.constants';

export type { SettingsErrorDetail as PrintTemplateAssignmentErrorDetail } from 'src/common/types/module-api.types';
export type { SettingsErrorResponse as PrintTemplateAssignmentErrorResponse } from 'src/common/types/module-api.types';
export type { SettingsSuccessResponse as PrintTemplateAssignmentSuccessResponse } from 'src/common/types/module-api.types';

export interface PrintTemplateAssignmentPayload {
  ptaId: string;
  /// NULL = every company — the ladder's widest rung, and the only scope a
  /// shipped design may be the default for.
  ptaCompanyId: string | null;
  ptaCompanyName: string | null;
  ptaBranchId: string | null;
  ptaBranchName: string | null;
  ptaDeviceId: string | null;
  ptaDeviceName: string | null;
  ptaPurposeId: string;
  ptaPurposeCode: string | null;
  ptaPurposeName: string | null;
  ptaTemplateId: string;
  ptaTemplateCode: string | null;
  ptaTemplateName: string | null;
  /// The template's OWNER, the nil uuid meaning "shipped with the product".
  /// Derived from the template by the service, never taken from the caller —
  /// ck_pta_template_scope is what stops one company's private design being
  /// assigned by another, and it can only work if this is true.
  ptaTemplateCompanyKey: string;
  /// Convenience for the UI: ptaTemplateCompanyKey is the nil uuid.
  ptaTemplateIsShipped: boolean;
  ptaOutputMode: string;
  ptaPrinterId: string | null;
  /// The BARE QUEUE NAME column — a fallback for a scope whose printer nobody
  /// has registered as a profile, and never a copy of a profile's name:
  /// ck_pta_printer_one_of refuses it alongside ptaPrinterId.
  ptaPrinterName: string | null;
  /// The registered profile's name, joined from printer_profile. NULL whenever
  /// ptaPrinterId is NULL.
  ptaPrinterProfileName: string | null;
  ptaCopies: number | null;
  /// Derived, never written: 3 counter, 2 branch, 1 company, 0 every company.
  ptaSpecificity: number | null;
  /// ptaSpecificity read as a word.
  ptaScope: PtaScope;
  ptaRemarks: string | null;
  ptaIsActive: boolean;
  ptaIsDeleted: boolean;
  ptaSyncDate: string | null;
  ptaCreatedOn: string;
  ptaCreatedBy: string | null;
  ptaModifiedOn: string | null;
  ptaModifiedBy: string | null;
}

/// What the render path actually asks for: one winning row, plus the copy
/// count the purpose contributes when the assignment does not override it.
export interface PrintTemplateAssignmentResolution {
  ptaId: string;
  ptaSpecificity: number | null;
  scope: PtaScope;
  ptaTemplateId: string;
  ptaTemplateCode: string | null;
  ptaTemplateName: string | null;
  ptaTemplateIsShipped: boolean;
  publishedRevId: string | null;
  ptaPrinterId: string | null;
  /// ONE name for the render path to use: the registered profile's when
  /// ptaPrinterId is set, the bare fallback otherwise, NULL when neither was
  /// given and the server's default queue applies. printerSource says which.
  ptaPrinterName: string | null;
  printerSource: PtaPrinterSource;
  ptaOutputMode: string;
  copies: number;
  copyLabels: string[];
}

export interface PrintTemplateAssignmentListResult {
  items: PrintTemplateAssignmentPayload[];
  page: number;
  limit: number;
  total: number;
}
