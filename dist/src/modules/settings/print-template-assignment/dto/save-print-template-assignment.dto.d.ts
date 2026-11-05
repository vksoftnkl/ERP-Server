export declare class SavePrintTemplateAssignmentDto {
    ptaId?: string;
    ptaCompanyId?: string | null;
    ptaBranchId?: string | null;
    ptaDeviceId?: string | null;
    ptaPurposeId: string;
    ptaTemplateId: string;
    ptaOutputMode?: string;
    ptaPrinterId?: string | null;
    ptaPrinterName?: string | null;
    ptaCopies?: number | null;
    ptaRemarks?: string | null;
    ptaIsActive?: boolean;
    ptaCreatedBy?: string | null;
    ptaModifiedBy?: string | null;
}
