import { VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
export declare class SaveVoucherTypeDto {
    companyId: string;
    vchrTypeId?: number;
    vchrParentId?: number | null;
    vchrTypeName?: string;
    vchrTypeShort?: string;
    vchrSortOrder?: number;
    vchrIsActive?: boolean;
    vchrNumberingMode?: VoucherNumberingMode;
    vchrNoPrefix?: string | null;
    vchrNoSuffix?: string | null;
    vchrNoWidth?: number;
    vchrResetFreq?: VoucherResetFreq;
    vchrStartNo?: number;
    vchrPrintTitle?: string | null;
    vchrPrintPurposeId?: string | null;
    vchrPrintAfterPost?: boolean;
    vchrTallyVoucherTypeName?: string | null;
    vchrDeliveryMode?: string | null;
    offerBase?: boolean;
    branchId?: string;
    accYear?: string;
}
export declare class ValidateVoucherTypeDto extends SaveVoucherTypeDto {
}
