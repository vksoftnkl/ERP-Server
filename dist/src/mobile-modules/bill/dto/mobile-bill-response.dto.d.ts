declare class MobileBillGodownDto {
    godownId: string;
    name: string;
    shortName: string | null;
    isDefault: boolean;
}
export declare class MobileBillOptionsDto {
    companyId: string;
    branchId: string;
    godowns: MobileBillGodownDto[];
}
export declare class MobileBillOptionsSuccessDto {
    success: true;
    message: string;
    data: MobileBillOptionsDto;
}
export declare class MobileBillCreateResultDto {
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
export declare class MobileBillCreateSuccessDto {
    success: true;
    message: string;
    data: MobileBillCreateResultDto;
}
export {};
