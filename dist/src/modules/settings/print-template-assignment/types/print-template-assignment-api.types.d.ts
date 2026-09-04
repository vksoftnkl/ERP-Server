import type { PtaPrinterSource, PtaScope } from '../print-template-assignment.constants';
export type { SettingsErrorDetail as PrintTemplateAssignmentErrorDetail } from "../../../../common/types/module-api.types";
export type { SettingsErrorResponse as PrintTemplateAssignmentErrorResponse } from "../../../../common/types/module-api.types";
export type { SettingsSuccessResponse as PrintTemplateAssignmentSuccessResponse } from "../../../../common/types/module-api.types";
export interface PrintTemplateAssignmentPayload {
    ptaId: string;
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
    ptaTemplateCompanyKey: string;
    ptaTemplateIsShipped: boolean;
    ptaOutputMode: string;
    ptaPrinterId: string | null;
    ptaPrinterName: string | null;
    ptaPrinterProfileName: string | null;
    ptaCopies: number | null;
    ptaSpecificity: number | null;
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
