import { LedGstPartyRegType, LedObType } from '../types/account-ledger-master-enum';
import { AccLedgerProfile } from '../../accGroupMaster/types/acc-group-master-enum';
import { LedgerBankAccountPayloadDto } from '../../ledgerBankAccount/dto/ledger-bank-account-response.dto';
export declare class AccountLedgerMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class AccountLedgerMasterErrorResponseDto {
    success: false;
    message: string;
    errors: AccountLedgerMasterErrorFieldDto[];
}
export declare class AccountLedgerMasterPayloadDto {
    ledId: string;
    ledCompanyId: string | null;
    ledCompanyName: string | null;
    ledBranchId: string | null;
    ledBranchName: string | null;
    ledGroupId: string;
    ledGroupName: string | null;
    ledGroupLedgerProfile: AccLedgerProfile | null;
    ledName: string;
    ledAlias: string | null;
    ledShort: string | null;
    ledTallyName: string | null;
    ledTallyGroupName: string | null;
    ledTallyGuid: string | null;
    ledTallyMasterId: string | null;
    ledTallyAlterId: string | null;
    ledCategory: string;
    ledLedgerType: string | null;
    ledMailingName: string | null;
    ledIsBillByBill: boolean;
    ledIsCostCenterReq: boolean;
    ledIsInterestApplicable: boolean;
    ledInterestRate: number | null;
    ledContactPerson: string | null;
    ledEmail: string | null;
    ledTel: string | null;
    ledPhone1: string | null;
    ledPhone2: string | null;
    ledWhatsappNo: string | null;
    ledAddr1: string | null;
    ledAddr2: string | null;
    ledAddr3: string | null;
    ledCity: string | null;
    ledDistrict: string | null;
    ledStateName: string | null;
    ledStateCode: string | null;
    ledPin: string | null;
    ledCountry: string | null;
    ledRegionName: string | null;
    ledRegionAddr1: string | null;
    ledRegionAddr2: string | null;
    ledRegionAddr3: string | null;
    ledRegionCity: string | null;
    ledRegionDistrict: string | null;
    ledRegionStateName: string | null;
    ledRegionCountry: string | null;
    ledGstPartyRegType: LedGstPartyRegType | null;
    ledGstinNo: string | null;
    ledPanNo: string | null;
    ledAadharNo: string | null;
    ledEcommerceGstin: string | null;
    ledIsSez: boolean;
    ledTypeOfSupply: string | null;
    ledHsnSac: string | null;
    ledGstRate: number | null;
    ledTaxability: string | null;
    ledGstPartyType: string | null;
    ledTanNo: string | null;
    ledCin: string | null;
    ledUdyamNo: string | null;
    ledMsmeType: string | null;
    ledGstDutyHead: string | null;
    ledTaxRate: number | null;
    ledRoundingMethod: string | null;
    ledRoundingLimit: number | null;
    ledIsTdsApplicable: boolean;
    ledTdsDeducteeType: string | null;
    ledTdsNatureOfPayment: string | null;
    ledIsTcsApplicable: boolean;
    ledObAmount: number;
    ledObType: LedObType;
    ledObAsOn: string | null;
    ledTotalDr: number;
    ledTotalCr: number;
    ledTotalBalance: number;
    ledSortOrder: number | null;
    ledIsActive: boolean;
    ledIsDeleted: boolean;
    ledAllowEdit: boolean;
    ledIsEntry: boolean;
    ledAllowSms: boolean;
    ledRemarks: string | null;
    ledSyncDate: string | null;
    ledCreatedOn: string;
    ledCreatedBy: string | null;
    ledModifiedOn: string;
    ledModifiedBy: string | null;
    ledgerBankAccount: LedgerBankAccountPayloadDto[];
}
export declare class AccountLedgerMasterDeleteResultDto {
    ledId: string;
    deleted: true;
}
export declare class AccountLedgerMasterSuccessSingleDto {
    success: true;
    message: string;
    data: AccountLedgerMasterPayloadDto;
}
export declare class AccountLedgerMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: AccountLedgerMasterDeleteResultDto;
}
export declare class AccountLedgerMasterSuccessListDto {
    success: true;
    message: string;
    data: AccountLedgerMasterPayloadDto[];
}
export declare class AccountLedgerMasterBankAccountSingleDto {
    success: true;
    message: string;
    data: LedgerBankAccountPayloadDto;
}
export declare class AccountLedgerMasterBankAccountListDataDto {
    data: LedgerBankAccountPayloadDto[];
    total: number;
}
export declare class AccountLedgerMasterBankAccountListDto {
    success: true;
    message: string;
    data: AccountLedgerMasterBankAccountListDataDto;
}
export declare class AccountLedgerMasterBankAccountsDeleteResultDto {
    lbaId: string;
    deleted: true;
}
export declare class AccountLedgerMasterBankAccountsDeleteDto {
    success: true;
    message: string;
    data: AccountLedgerMasterBankAccountsDeleteResultDto;
}
