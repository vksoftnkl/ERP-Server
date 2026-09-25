import type { SupplyNature } from '../../modules/accountsModule/ledgerRole/ledger-map.helper';
export interface VoucherLeg {
    role?: string | null;
    ledgerId?: string | null;
    drCr: 'DR' | 'CR';
    amount: number;
    taxId?: string | null;
    supplyNature?: SupplyNature | null;
    remarks?: string | null;
    docId?: string | null;
    docAccYear?: string | null;
    docRefno?: string | null;
    field?: string;
    roleTag?: string | null;
}
export interface VoucherHeaderInput {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    accYear: string;
    voucherTypeId: number;
    voucherDate: string;
    srcModule?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    docLabel?: string | null;
    docRefno?: string | null;
    docDate?: string | null;
    usrRefno?: string | null;
    docAmount: number;
    roundOff?: number;
    partyId: string | null;
    userId: string;
    sessionId?: string | null;
    deviceType?: string | null;
    deviceId?: string | null;
    remarks?: string | null;
    deviceCode?: string | null;
    createdBy?: string;
    presetRefno?: string | null;
    presetNo?: bigint | null;
    restateVoucherId?: string | null;
    draftVoucherId?: string | null;
}
export interface VoucherLegSource {
    header: VoucherHeaderInput;
    legs: VoucherLeg[];
}
export interface VoucherPostingResult {
    voucherId: string;
    voucherNo: string | null;
    voucherRefno: string | null;
    voucherSlno: bigint;
    voucherLastNo: bigint;
    postedOn: Date;
    totalDebit: number;
    totalCredit: number;
    legCount: number;
}
