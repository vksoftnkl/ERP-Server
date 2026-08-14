import { TenderDrCr, TenderSettleStatus, TenderSrcDocType, TenderSrcModule } from '../types/tender-detail-api.types';
export declare class TenderDetailErrorFieldDto {
    field: string;
    message: string;
}
export declare class TenderDetailErrorResponseDto {
    success: false;
    message: string;
    errors: TenderDetailErrorFieldDto[];
}
export declare class TenderDetailPayloadDto {
    tdId: string;
    tdCompanyId: string;
    tdBranchId: string;
    tdTenantId: string | null;
    tdAccYear: string;
    tdSrcModule: TenderSrcModule;
    tdSrcDocType: TenderSrcDocType;
    tdSrcDocId: string;
    tdRowNo: number;
    tdDocDate: string;
    tdPartyLedgerId: string;
    tdVoucherId: string | null;
    tdTenderId: string;
    tdTenderName: string | null;
    tdTenderTypeId: string;
    tdTenderLedgerId: string;
    tdTenderLedgerName: string | null;
    tdDrCr: TenderDrCr;
    tdAmount: number;
    tdSurchargePerc: number;
    tdSurchargeAmt: number;
    tdSurchargeLedgerId: string | null;
    tdTotalAmt: number;
    tdReceivedAmt: number;
    tdChangeAmt: number;
    tdUnitsUsed: number;
    tdConversionRate: number;
    tdRefNo: string | null;
    tdAuthCode: string | null;
    tdCardLast4: string | null;
    tdBankName: string | null;
    tdPayerVpa: string | null;
    tdInstrumentDate: string | null;
    tdIsPdc: boolean;
    tdSettleStatus: TenderSettleStatus;
    tdSettleLedgerId: string | null;
    tdExpectedSettleOn: string | null;
    tdSettledOn: string | null;
    tdSettleAmount: number | null;
    tdMdrAmt: number;
    tdSettleRefNo: string | null;
    tdSettleVoucherId: string | null;
    tdSessionId: string | null;
    tdDeviceId: string | null;
    tdUserId: string;
    tdNotes: string | null;
    tdIsDeleted: boolean;
    tdSyncDate: string | null;
    tdCreatedOn: string;
    tdCreatedBy: string;
    tdModifiedOn: string | null;
    tdModifiedBy: string | null;
}
export declare class TenderDetailSuccessSingleDto {
    success: true;
    message: string;
    data: TenderDetailPayloadDto;
}
export declare class TenderDetailSuccessManyDto {
    success: true;
    message: string;
    data: TenderDetailPayloadDto[];
}
export declare class TenderDetailDeleteResultDto {
    tdId: string;
    deleted: true;
}
export declare class TenderDetailSuccessDeleteDto {
    success: true;
    message: string;
    data: TenderDetailDeleteResultDto;
}
