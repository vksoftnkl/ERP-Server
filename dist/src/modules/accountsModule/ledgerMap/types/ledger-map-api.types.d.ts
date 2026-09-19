export type { AccountsErrorDetail as LedgerMapErrorDetail } from "../../../../common/types/module-api.types";
export type { AccountsErrorResponse as LedgerMapErrorResponse } from "../../../../common/types/module-api.types";
export type { AccountsSuccessResponse as LedgerMapSuccessResponse } from "../../../../common/types/module-api.types";
export interface LedgerMapRolePayload {
    role: string;
    label: string;
    group: string;
    sortOrder: number;
    expectedLedgerType: string | null;
    expectedDutyHead: string | null;
    expectedGroupNature: string | null;
    roleIsActive: boolean;
    usedBy: string[];
    almId: string | null;
    ledgerId: string | null;
    ledgerName: string | null;
    ledgerIsActive: boolean | null;
    ledgerIsDeleted: boolean | null;
    isActive: boolean | null;
    remarks: string | null;
}
export type LedgerMapPayload = LedgerMapRolePayload;
export interface LedgerMapDeletePayload {
    almId: string;
    role: string;
    deleted: true;
}
