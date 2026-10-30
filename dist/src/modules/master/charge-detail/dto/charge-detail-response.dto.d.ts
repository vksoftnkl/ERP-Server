import { ChargeApplyOn, ChargeCostAlloc, ChargeDocType, ChargeMethod, ChargeRole, ChargeType } from '../types/charge-detail-api.types';
export declare class ChargeDetailErrorFieldDto {
    field: string;
    message: string;
}
export declare class ChargeDetailErrorResponseDto {
    success: false;
    message: string;
    errors: ChargeDetailErrorFieldDto[];
}
export declare class ChargeDetailPayloadDto {
    cdId: string;
    cdDocType: ChargeDocType;
    cdDocId: string;
    cdSlno: number | null;
    cdCompId: string;
    cdBranchId: string;
    cdAccYear: string;
    cdVoucherNo: string | null;
    cdChgId: string;
    cdChgName: string | null;
    cdRole: ChargeRole | null;
    cdMethod: ChargeMethod | null;
    cdType: ChargeType;
    cdApplyOn: ChargeApplyOn | null;
    cdLedgerCode: string;
    cdLedgerName: string | null;
    cdLandingCost: boolean;
    cdCostAlloc: ChargeCostAlloc | null;
    cdBeforeTax: boolean;
    cdTaxApl: boolean;
    cdSepPost: boolean;
    cdUnit: string | null;
    cdQtyVal: number | null;
    cdWeight: number | null;
    cdRate: number | null;
    cdAmount: number | null;
    cdTaxCode: string | null;
    cdHsn: string | null;
    cdTaxPerc: number | null;
    cdTaxAmt: number | null;
    cdSgstPerc: number | null;
    cdSgstAmt: number | null;
    cdCgstPerc: number | null;
    cdCgstAmt: number | null;
    cdIgstPerc: number | null;
    cdIgstAmt: number | null;
    cdCessPerc: number | null;
    cdCessAmt: number | null;
    cdNetAmt: number | null;
    cdRemarks: string | null;
    cdIsActive: boolean;
    cdIsDeleted: boolean;
    cdSyncDate: string | null;
    cdCreatedOn: string;
    cdCreatedBy: string | null;
    cdModifiedOn: string | null;
    cdModifiedBy: string | null;
}
export declare class ChargeDetailSuccessSingleDto {
    success: true;
    message: string;
    data: ChargeDetailPayloadDto;
}
export declare class ChargeDetailSuccessManyDto {
    success: true;
    message: string;
    data: ChargeDetailPayloadDto[];
}
export declare class ChargeDetailDeleteResultDto {
    cdId: string;
    deleted: true;
}
export declare class ChargeDetailSuccessDeleteDto {
    success: true;
    message: string;
    data: ChargeDetailDeleteResultDto;
}
