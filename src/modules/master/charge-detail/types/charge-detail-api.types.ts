import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDocType,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../../charge-master/types/charge-enum';
// The cd_* enums and the CHECK-constraint guards live with the charge master,
// because every cd_* enum column is a snapshot of a chg_* one — there is only one
// definition of the allowed values and both modules read it from there.
export {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDocType,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../../charge-master/types/charge-enum';
export {
  CHARGE_APPLY_ONS,
  CHARGE_COST_ALLOCS,
  CHARGE_DETAIL_VALUE_GUARDS,
  CHARGE_DOC_TYPES,
  CHARGE_METHODS,
  CHARGE_ROLES,
  CHARGE_TYPES,
} from '../../charge-master/types/charge-master-api.types';
export type {
  ChargeDetailGuardedField,
  ChargeDetailGuardedValues,
} from '../../charge-master/types/charge-master-api.types';
export type ChargeDetailErrorDetail = ModuleApiErrorDetail;
export type ChargeDetailErrorResponse = ModuleApiErrorResponse<ChargeDetailErrorDetail>;
export type ChargeDetailSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
// One applied charge line. Every cd_* value except the amounts is a SNAPSHOT
// taken from the charge master at save time, so the payload mirrors the stored
// row rather than re-deriving anything — cdLedgerName is the only exception, a
// display label read from the mapped acc_ledger_master row.
export interface ChargeDetailPayload {
  cdId: string;
  cdDocType: ChargeDocType;
  cdDocId: string;
  cdSlno: number | null;
  cdCompId: string;
  cdBranchId: string;
  cdAccYear: string;
  // bigint column, carried as a string so large voucher numbers survive JSON.
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
export interface ChargeDetailDeleteResult {
  cdId: string;
  deleted: true;
}
// The parent document a charge line hangs off, as the owning module knows it.
// Every field is inherited by each line of that document unless the payload
// overrides it, so a bill / quotation never has to repeat its own scope on each
// charge it sends.
export interface ChargeDocumentScope {
  cdDocType: ChargeDocType;
  cdDocId: string;
  cdCompId: string;
  cdBranchId: string;
  cdAccYear: string;
  // The document's own voucher number (a bill's sbBillSlno, a quotation's
  // sqQuoteSlno), used when a charge line does not carry one of its own.
  cdVoucherNo: bigint | null;
}
// How an owning module labels the audit rows written for its charge lines, so a
// charge edited as part of a bill save stays on the bill's screen in the trail
// instead of the standalone Charge Detail one.
export interface ChargeDocumentAudit {
  tableName: string;
  screenName: string;
  // Prefixes the audit note: 'Bill charge' reads as "Bill charge created".
  entityName: string;
}
