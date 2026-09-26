export declare class TenderMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class TenderMasterErrorResponseDto {
    success: false;
    message: string;
    errors: TenderMasterErrorFieldDto[];
}
export declare class TenderMasterPayloadDto {
    tndId: string;
    tndCompanyId: string;
    tndBranchId: string | null;
    tndTypeId: string;
    tndName: string;
    tndShortName: string;
    tndLedgerId: string;
    tndSettlementLedgerId: string | null;
    tndCompanyName: string | null;
    tndBranchName: string | null;
    tndTypeName: string | null;
    tndLedgerName: string | null;
    tndSurchargeLedgerName: string | null;
    tndSettlementDays: number;
    tndBankAccountId: string | null;
    tndMinAmount: number;
    tndMaxAmount: number | null;
    tndDailyLimit: number | null;
    tndSurchargePerc: number;
    tndSurchargeAmount: number;
    tndSurchargeLedgerId: string | null;
    tndEditSurcharge: boolean;
    tndEditLedger: boolean;
    tndUpiVpa: string | null;
    tndUpiQrPayload: string | null;
    tndMerchantId: string | null;
    tndTerminalId: string | null;
    tndConversionRate: number;
    tndNeedsRef: boolean | null;
    tndAllowChange: boolean | null;
    tndAllowInReturn: boolean | null;
    tndOpenCashDrawer: boolean;
    tndIsDefault: boolean;
    tndDisplayPosition: number;
    tndHotkey: string | null;
    tndColour: string | null;
    tndEffectiveFrom: string | null;
    tndEffectiveTo: string | null;
    tndRemarks: string | null;
    tndIsActive: boolean;
    tndIsDeleted: boolean;
    tndSyncDate: string | null;
    tndCreatedOn: string;
    tndCreatedBy: string | null;
    tndModifiedOn: string | null;
    tndModifiedBy: string | null;
}
export declare class TenderMasterDeleteResultDto {
    tndId: string;
    deleted: true;
}
export declare class TenderMasterSuccessSingleDto {
    success: true;
    message: string;
    data: TenderMasterPayloadDto;
}
export declare class TenderMasterSuccessListDto {
    success: true;
    message: string;
    data: TenderMasterPayloadDto[];
}
export declare class TenderMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: TenderMasterDeleteResultDto;
}
