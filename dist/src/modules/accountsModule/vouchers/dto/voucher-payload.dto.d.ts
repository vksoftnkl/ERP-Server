export declare class VoucherLineGstDto {
    taxId: string;
    hsn?: string | null;
    itcEligibility?: string | null;
}
export declare class VoucherLineDto {
    rowNo: number;
    drCr: 'DR' | 'CR';
    ledgerId: string;
    amount: string;
    remarks?: string | null;
    gst?: VoucherLineGstDto | null;
    tdsBase?: boolean | null;
}
export declare class VoucherAllocationDto {
    lineRowNo: number;
    billId: string;
    billAccYear: string;
    amount: string;
}
export declare class VoucherNewBillDto {
    dueDays?: number | null;
}
export declare class VoucherHeaderDto {
    voucherId?: string | null;
    companyId: string;
    branchId: string;
    accYear: string;
    typeCode: string;
    date: string;
    partyId?: string | null;
    docRefno?: string | null;
    docDate?: string | null;
    usrRefno?: string | null;
    posStcd?: string | null;
    reverseCharge?: boolean;
    remarks?: string | null;
}
export declare class VoucherPayloadDto {
    header: VoucherHeaderDto;
    lines: VoucherLineDto[];
    allocations?: VoucherAllocationDto[];
    newBill?: VoucherNewBillDto | null;
}
export declare class ValidateVoucherDto extends VoucherPayloadDto {
    overrides?: string[];
}
export declare class PostVoucherDto extends ValidateVoucherDto {
}
export declare class VoucherKeysDto {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherId: string;
}
export declare class CancelVoucherDto extends VoucherKeysDto {
    reason: string;
}
export declare class DeleteVoucherDto extends VoucherKeysDto {
}
export declare class GetVoucherQueryDto extends VoucherKeysDto {
}
