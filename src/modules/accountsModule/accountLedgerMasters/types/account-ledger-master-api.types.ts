import type {
  LedGstPartyRegType,
  LedItcEligibility,
  LedObType,
} from './account-ledger-master-enum';
import type { AccLedgerProfile } from '../../accGroupMaster/types/acc-group-master-enum';
import type { LedgerBankAccountPayload } from '../../ledgerBankAccount/types/ledger-bank-account-api.types';
export type { AccountsErrorDetail as AccountLedgerMasterErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as AccountLedgerMasterErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as AccountLedgerMasterSuccessResponse } from 'src/common/types/module-api.types';
export {
  LedGstPartyRegType,
  LedGstDutyHead,
  LedItcEligibility,
  LedLedgerType,
  LedMsmeType,
  LedObType,
  LedRoundingMethod,
  LedTypeOfSupply,
  BankAccountType,
} from './account-ledger-master-enum';
export type { LedgerBankAccountPayload } from '../../ledgerBankAccount/types/ledger-bank-account-api.types';
export interface AccountLedgerMasterPayload {
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
  ledTaxId: string | null;
  // Echoed from the referenced tax_rate_master row — display only; the rate is
  // edited on that master, never here.
  ledTaxName: string | null;
  ledTaxRatePerc: number | null;
  ledTaxTaxability: string | null;
  ledGstPartyType: string | null;
  ledTanNo: string | null;
  ledCin: string | null;
  ledUdyamNo: string | null;
  ledMsmeType: string | null;
  ledGstDutyHead: string | null;
  ledRoundingMethod: string | null;
  ledRoundingLimit: number | null;
  ledIsTdsApplicable: boolean;
  ledTdsDeducteeType: string | null;
  ledTdsNatureOfPayment: string | null;
  ledIsTcsApplicable: boolean;
  ledItcEligibility: LedItcEligibility | null;
  ledIsReverseCharge: boolean;
  // Read-only from here on. §3.1 took all six out of the save DTO: a shared
  // ledger spans every company, so one opening balance on its row cannot be
  // right. accounts.acc_opening_balance (company + branch + acc_year) is the
  // only place that can hold one.
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
  ledgerBankAccount: LedgerBankAccountPayload[];
}
