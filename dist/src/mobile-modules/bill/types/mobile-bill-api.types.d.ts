export interface MobileBillGodown {
    godownId: string;
    name: string;
    shortName: string | null;
    isDefault: boolean;
}
export interface MobileBillOptions {
    companyId: string;
    branchId: string;
    godowns: MobileBillGodown[];
}
export interface MobileBillCreateResult {
    sbId: string;
    sbCompanyId: string;
    sbBranchId: string;
    sbAccYear: string;
    sbBillRefno: string;
    sbUsrRefno: string | null;
    sbBillDate: string;
    sbBillAmt: string;
    sbStatus: string;
    duplicate: boolean;
    sbIsDeleted: boolean;
}
