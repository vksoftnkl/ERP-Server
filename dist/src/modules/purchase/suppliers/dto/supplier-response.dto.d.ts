import { LedgerBankAccountPayloadDto } from '../../../accountsModule/ledgerBankAccount/dto/ledger-bank-account-response.dto';
export declare class SupplierErrorFieldDto {
    field: string;
    message: string;
}
export declare class SupplierErrorResponseDto {
    success: false;
    message: string;
    errors: SupplierErrorFieldDto[];
}
export declare class SupplierPayloadDto {
    supId: string;
    supCompanyId: string | null;
    supCompanyName?: string | null;
    supBranchId: string | null;
    supBranchName?: string | null;
    supGroupId: string;
    supGroupName?: string | null;
    supPurchaseType: string;
    supName: string;
    supShort: string | null;
    supAddr1: string | null;
    supAddr2: string | null;
    supAddr3: string | null;
    supCity: string | null;
    supDistrict: string | null;
    supStateName: string;
    supCountry: string | null;
    supPincode: string | null;
    supTel: string | null;
    supPhone: string | null;
    supMailId: string | null;
    supWhatsappNo: string | null;
    supWebsiteAddress: string | null;
    supChequePreName: string | null;
    supNotes: string | null;
    supCreditDays: number;
    supCashDiscPerc: number;
    supCollectionDays: number[];
    supGstNo: string | null;
    supStateCode: string;
    supPanNo: string | null;
    supGstType: string;
    supSupCst: string | null;
    supDrugLiscenceNo: string | null;
    supRegionName: string | null;
    supRegionAddr1: string | null;
    supRegionAddr2: string | null;
    supRegionAddr3: string | null;
    supRegionCity: string | null;
    supRegionDistrict: string | null;
    supRegionStateName: string | null;
    supRegionCountry: string | null;
    supBilledDate: string | null;
    supSortOrder: number | null;
    supIsActive: boolean;
    supIsDeleted: boolean;
    supSyncDate: string | null;
    supCreatedOn: string;
    supCreatedBy: string | null;
    supModifiedOn: string;
    supModifiedBy: string | null;
    ledgerBankAccount: LedgerBankAccountPayloadDto[];
}
export declare class SupplierDeleteResultDto {
    supId: string;
    deleted: true;
}
export declare class SupplierSuccessSingleDto {
    success: true;
    message: string;
    data: SupplierPayloadDto;
}
export declare class SupplierSuccessDeleteDto {
    success: true;
    message: string;
    data: SupplierDeleteResultDto;
}
