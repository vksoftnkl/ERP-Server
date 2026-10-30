export declare class SaveCustomerGroupDto {
    cgrId?: string;
    cgrCompanyId?: string | null;
    cgrBranchId?: string | null;
    cgrName: string;
    cgrAlias?: string | null;
    cgrShort?: string | null;
    cgrNarration?: string | null;
    cgrOrder?: number | null;
    cgrDiscPerc?: number | null;
    cgrCollectionDays?: number[];
    cgrDebitAllowed?: boolean;
    cgrDebitDays?: number | null;
    cgrDebitLimit?: number | null;
    cgrBillsLimit?: number | null;
    cgrOverdueBilling?: boolean;
    cgrIsActive?: boolean;
}
