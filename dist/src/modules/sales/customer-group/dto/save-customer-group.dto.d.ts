export declare class SaveCustomerGroupDto {
    cgrId?: string;
    cgrCompanyId?: string | null;
    cgrBranchId?: string | null;
    cgrName: string;
    cgrAlias?: string | null;
    cgrShort?: string | null;
    cgrNarration?: string | null;
    cgrOrder?: number;
    cgrDiscPerc?: number;
    cgrCollectionDays?: number[];
    cgrDebitAllowed?: boolean;
    cgrDebitDays?: number;
    cgrDebitLimit?: number;
    cgrBillsLimit?: number;
    cgrOverdueBilling?: boolean;
    cgrIsActive?: boolean;
}
