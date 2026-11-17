export declare class VoucherTypeTreeQueryDto {
    companyId: string;
    includeInactive?: boolean;
}
export declare class VoucherTypeGetQueryDto {
    companyId: string;
    branchId: string;
    accYear: string;
    vchrTypeId: number;
}
export declare class VoucherTypeRefDto {
    companyId: string;
    vchrTypeId: number;
}
export declare class PrintDesignCloneDto {
    companyId: string;
    fromPpoCode: string;
    ppoCode: string;
    ppoName: string;
}
