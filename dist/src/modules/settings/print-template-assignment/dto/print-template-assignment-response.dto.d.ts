import { ModuleErrorFieldDto, ModuleErrorResponseDto } from "../../../../common/utils/module-response.dto";
import { type PtaPrinterSource, type PtaScope } from '../print-template-assignment.constants';
export { ModuleErrorFieldDto as PrintTemplateAssignmentErrorFieldDto };
export { ModuleErrorResponseDto as PrintTemplateAssignmentErrorResponseDto };
export declare class PrintTemplateAssignmentPayloadDto {
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
export declare class PrintTemplateAssignmentResolutionDto {
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
export declare class PrintTemplateAssignmentDeleteResultDto {
    ptaId: string;
    deleted: true;
}
export declare class PrintTemplateAssignmentListDataDto {
    items: PrintTemplateAssignmentPayloadDto[];
    page: number;
    limit: number;
    total: number;
}
export declare class PrintTemplateAssignmentSuccessSingleDto {
    success: true;
    message: string;
    data: PrintTemplateAssignmentPayloadDto;
}
export declare class PrintTemplateAssignmentSuccessCreateDto {
    success: true;
    message: string;
    data: PrintTemplateAssignmentPayloadDto;
}
export declare class PrintTemplateAssignmentSuccessListDto {
    success: true;
    message: string;
    data: PrintTemplateAssignmentListDataDto;
}
export declare class PrintTemplateAssignmentSuccessResolveDto {
    success: true;
    message: string;
    data: PrintTemplateAssignmentResolutionDto;
}
export declare class PrintTemplateAssignmentSuccessDeleteDto {
    success: true;
    message: string;
    data: PrintTemplateAssignmentDeleteResultDto;
}
