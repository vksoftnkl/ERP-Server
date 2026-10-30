export declare class SaveAccGroupMasterDto {
    accGroupId?: string;
    accGroupName: string;
    accGroupAlias?: string | null;
    accGroupShort?: string | null;
    accGroupDescription?: string | null;
    accGroupParentId?: string | null;
    accGroupSort?: number;
    accGroupBehaveAsSubledger?: boolean;
    accGroupNetDebitCredit?: boolean;
    accGroupUsedForCalculation?: boolean;
    accGroupAffectsGrossProfit?: boolean;
    accGroupIsActive?: boolean;
}
