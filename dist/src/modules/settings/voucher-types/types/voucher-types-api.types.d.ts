import type { AccVoucherType, VoucherNumberingMode } from '@prisma/client';
import type { MirrorField, NumberedBy, NumberingPreview, VoucherKind, VtIssue } from '../voucher-types.rules';
export interface VoucherTypeNode {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
    vchrTypeShort: string | null;
    vchrParentId: number | null;
    vchrCompanyId: string | null;
    vchrNature: string;
    kind: VoucherKind;
    numberedBy: NumberedBy;
    vchrIsActive: boolean;
    vchrSortOrder: number;
    childCount: number;
    canHaveChildren: boolean;
    vchrNoPrefix: string | null;
    vchrNoSuffix: string | null;
}
export interface VoucherTypeBranchState {
    branchId: string;
    branchName: string;
    branchCode: string | null;
    isDefault: boolean;
    hasCounter: boolean;
    lastVoucherRefno: string | null;
}
export interface VoucherTypeCounter {
    branchId: string;
    branchName: string;
    branchCode: string | null;
    deviceCode: string;
    lastNo: string;
    lastRefno: string | null;
    allBranches: boolean;
}
export interface VoucherTypePrintDesign {
    ppoId: string;
    ppoCode: string;
    ppoName: string;
    ppoCopyCount: number;
    ppoCopyLabels: string | null;
    isShared: boolean;
    hasLayout: boolean;
    hasAssignment: boolean;
}
export interface VoucherTypePayload {
    type: AccVoucherType;
    inherited: Pick<AccVoucherType, MirrorField | 'vchrTypeId' | 'vchrTypeCode' | 'vchrTypeName'>;
    kind: VoucherKind;
    numberedBy: NumberedBy;
    isBase: boolean;
    isGstOutward: boolean;
    canHaveChildren: boolean;
    allowedMethods: VoucherNumberingMode[];
    offerBase: boolean | null;
    billCount: number;
    inUse: boolean;
    counters: VoucherTypeCounter[];
    voucherCount: number;
    lastVoucherRefno: string | null;
    lastVoucherDate: string | null;
    branches: VoucherTypeBranchState[];
    printDocType: string | null;
    printDesigns: VoucherTypePrintDesign[];
    preview: NumberingPreview;
    deliveryModeApplies: boolean;
    inheritedDeliveryMode: string | null;
    effectiveDeliveryMode: string | null;
}
export interface VoucherTypeValidation {
    ok: boolean;
    errors: VtIssue[];
    warnings: VtIssue[];
    preview: NumberingPreview;
    vchrDeliveryMode: string | null;
    deliveryModeApplies: boolean;
    inheritedDeliveryMode: string | null;
    effectiveDeliveryMode: string | null;
}
