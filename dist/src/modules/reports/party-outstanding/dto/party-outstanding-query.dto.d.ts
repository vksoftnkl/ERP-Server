import { type CollectionDay } from '../party-outstanding.ageing';
export declare const OUTSTANDING_SIDES: readonly ["RECEIVABLE", "PAYABLE"];
export declare const AGE_BY_VALUES: readonly ["BILL_DATE", "DUE_DATE"];
export declare const SORT_DIRS: readonly ["asc", "desc"];
export declare const PARTY_SORTS: readonly ["net", "name", "overdue", "oldest", "owed", "bucket0", "bucket1", "bucket2", "bucket3", "bucket4", "bucket5", "bucket6", "bucket7"];
export declare const BILL_SORTS: readonly ["date", "party", "due", "refno", "pending", "age", "overdue"];
export declare const SUMMARY_GROUP_BY: readonly ["AREA", "GROUP", "SALESMAN", "BRANCH"];
export declare const EXPORT_SHAPES: readonly ["PARTIES", "BILLS", "PARTY_STATEMENT"];
export type PartySort = (typeof PARTY_SORTS)[number];
export type BillSort = (typeof BILL_SORTS)[number];
export type SortDir = (typeof SORT_DIRS)[number];
export declare class OutstandingOptionsDto {
    companyId: string;
    side: (typeof OUTSTANDING_SIDES)[number];
}
export declare class OutstandingFilterDto extends OutstandingOptionsDto {
    asOn: string;
    branchId?: string;
    groupId?: string;
    areaId?: string;
    collectionDay?: CollectionDay;
    salesmanId?: string;
    ageBy?: (typeof AGE_BY_VALUES)[number];
    buckets?: string;
    onlyOverdue?: boolean;
    includeOnAccount?: boolean;
    deductPdc?: boolean;
    hideZero?: boolean;
    minDueDays?: number;
    maxDueDays?: number;
}
export declare class OutstandingScopeDto extends OutstandingFilterDto {
    partyId?: string;
}
export declare class OutstandingPartyDto extends OutstandingFilterDto {
    partyId: string;
}
export declare class OutstandingPartiesDto extends OutstandingScopeDto {
    sort?: PartySort;
    dir?: SortDir;
    page?: number;
    pageSize?: number;
}
export declare class OutstandingBillWiseDto extends OutstandingScopeDto {
    sort?: BillSort;
    dir?: SortDir;
    page?: number;
    pageSize?: number;
    dueOn?: string;
}
export declare class OutstandingBillHistoryDto {
    companyId: string;
    billId: string;
    accYear: string;
    asOn: string;
}
export declare class OutstandingSummaryDto extends OutstandingScopeDto {
    groupBy: (typeof SUMMARY_GROUP_BY)[number];
}
export declare class OutstandingDueCalendarDto extends OutstandingScopeDto {
    from: string;
    to: string;
}
export declare class OutstandingExportDto extends OutstandingScopeDto {
    shape: (typeof EXPORT_SHAPES)[number];
    sort?: PartySort | BillSort;
    dir?: SortDir;
}
