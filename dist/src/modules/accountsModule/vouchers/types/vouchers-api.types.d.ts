import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { VoucherErrorDetail, VoucherRefusal, VoucherWarning } from '../vouchers.errors';
export type VoucherApiErrorDetail = ModuleApiErrorDetail & Partial<VoucherErrorDetail>;
export type VoucherErrorResponse = ModuleApiErrorResponse<VoucherApiErrorDetail>;
export type VoucherSuccessResponse<T> = ModuleApiSuccessResponse<T>;
export type DrCr = 'DR' | 'CR';
export type PartyMode = 'NONE' | 'ONE' | 'MANY';
export type PartySide = 'DR' | 'CR' | 'ANY';
export type BillwiseMode = 'OFF' | 'DEMAND' | 'RAISE' | 'OPTIONAL';
export type GstSide = 'INPUT' | 'OUTPUT';
export type TdsMode = 'OFF' | 'DEDUCT';
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export interface VoucherRights {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    post: boolean;
    cancel: boolean;
    print: boolean;
    override: boolean;
}
export interface VoucherGroupRef {
    groupId: string;
    name: string;
}
export interface VoucherTypeRules {
    typeId: number;
    typeCode: string;
    typeName: string;
    nature: string;
    numberPrefix: string | null;
    menuId: number | null;
    partyMode: PartyMode;
    partySide: PartySide;
    billwiseMode: BillwiseMode;
    raiseBillType: string | null;
    drGroups: VoucherGroupRef[];
    crGroups: VoucherGroupRef[];
    gstRegister: string | null;
    gstSide: GstSide | null;
    tdsMode: TdsMode;
    inRegister: boolean;
    affectsInventory: boolean;
}
export interface VoucherTypeWithRights extends VoucherTypeRules {
    rights: VoucherRights;
}
export interface VoucherTypesPayload {
    menuId: number | null;
    types: VoucherTypeWithRights[];
}
export interface LedgerPickRow {
    ledId: string;
    name: string;
    groupId: string;
    groupName: string;
    isParty: boolean;
    isBillByBill: boolean;
    gstApplicable: boolean;
    itcEligibility: string | null;
    defaultTaxId: string | null;
    isTdsApplicable: boolean;
    tdsSection: string | null;
}
export interface LedgerPickPayload {
    typeCode: string;
    side: DrCr;
    ledgers: LedgerPickRow[];
}
export interface SidedAmount {
    amount: number;
    side: DrCr;
}
export interface LedgerBalancePayload extends SidedAmount {
    ledgerId: string;
    asOn: string;
    opening: SidedAmount;
}
export interface PartyTdsFacts {
    applicable: boolean;
    section: string | null;
    deducteeType: string | null;
    rate: number | null;
    rateSource: string | null;
    thresholdSingle: number | null;
    thresholdAnnual: number | null;
}
export interface PartyFactsPayload {
    partyId: string;
    name: string;
    gstin: string | null;
    gstType: string | null;
    stateCode: string | null;
    stateName: string | null;
    creditDays: number;
    isBillByBill: boolean;
    pan: string | null;
    tds: PartyTdsFacts | null;
    outstanding: SidedAmount;
}
export interface OpenBillRow {
    ablId: string;
    ablAccYear: string;
    refno: string;
    docRefno: string;
    date: string;
    dueDate: string | null;
    billType: string;
    side: DrCr;
    billAmount: number;
    pending: number;
}
export interface OpenBillsPayload {
    partyId: string;
    side: DrCr;
    bills: OpenBillRow[];
}
export interface TaxRateRow {
    taxId: string;
    name: string;
    ratePerc: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    isReverseCharge: boolean;
    taxability: string;
}
export interface TaxRatesPayload {
    rates: TaxRateRow[];
}
export type LegSource = 'TYPED' | 'GST' | 'RCM' | 'TDS' | 'PARTY';
export interface DerivedLeg {
    rowNo: number;
    lineRowNo: number | null;
    drCr: DrCr;
    ledgerId: string;
    ledgerName: string;
    groupName: string | null;
    amount: number;
    generated: boolean;
    source: LegSource;
    role: string | null;
    remarks: string | null;
    fromRows: number[];
    gst: {
        taxId: string;
        hsn: string | null;
        itcEligibility: string | null;
        isTdsBase: boolean;
    } | null;
    isTdsBase: boolean;
}
export interface GstSummaryRow {
    taxId: string;
    taxName: string;
    ratePerc: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    lines: number[];
}
export interface GstSummary {
    register: string;
    side: GstSide;
    docType: string;
    supplyNature: 'INTRA_STATE' | 'INTER_STATE';
    placeOfSupply: string;
    reverseCharge: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
    rows: GstSummaryRow[];
}
export interface TdsSummary {
    section: string;
    deducteeType: string;
    rate: number;
    rateSource: string;
    base: number;
    tax: number;
    deducted: boolean;
    reason: string | null;
    fromRows: number[];
}
export interface TdsLineSummary extends TdsSummary {
    lineRowNo: number | null;
    partyId: string;
    partyName: string;
}
export interface DerivedParty {
    ledgerId: string;
    name: string;
    side: DrCr;
    amount: number;
    rowNo: number;
}
export interface DerivedBill {
    lineRowNo: number;
    partyId: string;
    partyName: string;
    billType: string;
    side: DrCr;
    amount: number;
    docRefno: string | null;
    dueDays: number;
    dueDate: string;
}
export interface DerivedAllocation {
    lineRowNo: number;
    billId: string;
    billAccYear: string;
    billRefno: string;
    billType: string;
    amount: number;
    pendingBefore: number;
    adjType: string;
}
export interface DerivedVoucher {
    typeCode: string;
    date: string;
    legs: DerivedLeg[];
    totals: {
        debit: number;
        credit: number;
        difference: number;
    };
    party: DerivedParty | null;
    gst: GstSummary | null;
    tds: TdsSummary | null;
    tdsLines: TdsLineSummary[];
    bills: DerivedBill[];
    allocations: DerivedAllocation[];
}
export interface ValidatePayload {
    ok: boolean;
    derived: DerivedVoucher;
    refusals: VoucherRefusal[];
    warnings: VoucherWarning[];
}
export interface VoucherHeaderPayload {
    voucherId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    typeId: number;
    typeCode: string;
    typeName: string;
    voucherNo: number | null;
    voucherRefno: string | null;
    date: string;
    partyId: string | null;
    partyName: string | null;
    docRefno: string | null;
    docDate: string | null;
    usrRefno: string | null;
    remarks: string | null;
    docAmount: number;
    totalDebit: number;
    totalCredit: number;
    status: VoucherStatus;
    statusOn: string | null;
    postedOn: string | null;
    cancelReason: string | null;
    reversalVoucherId: string | null;
    reversalAccYear: string | null;
    reversalRefno: string | null;
    againstVoucherId: string | null;
    againstAccYear: string | null;
    againstRefno: string | null;
    createdBy: string | null;
    createdOn: string | null;
    modifiedBy: string | null;
    modifiedOn: string | null;
}
export interface VoucherLegPayload {
    avId: string;
    rowNo: number;
    drCr: DrCr;
    ledgerId: string;
    ledgerName: string;
    groupName: string | null;
    amount: number;
    role: string | null;
    generated: boolean;
    remarks: string | null;
    oppLedgerId: string | null;
}
export interface VoucherAllocationPayload {
    abjId: string;
    rowNo: number;
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billType: string | null;
    againstBillId: string | null;
    againstBillAccYear: string | null;
    adjType: string;
    drCr: DrCr;
    amount: number;
    adjDate: string;
    isReversal: boolean;
    reversalOfId: string | null;
}
export interface VoucherBillPayload {
    ablId: string;
    ablAccYear: string;
    billType: string;
    docRefno: string;
    docDate: string;
    dueDate: string | null;
    side: DrCr;
    billAmount: number;
    allocAmount: number;
    pendingAmount: number;
    status: string | null;
    isDeleted: boolean;
}
export interface VoucherGstDocPayload {
    gdrId: string;
    docType: string;
    docStatus: string;
    docNo: string;
    docDate: string;
    supplyNature: string | null;
    placeOfSupply: string | null;
    isReverseCharge: boolean;
    isEinvoiceApplicable: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    billValue: number;
    lines: {
        rowNo: number;
        taxId: string | null;
        hsn: string | null;
        isService: boolean;
        taxable: number;
        ratePerc: number;
        cgst: number;
        sgst: number;
        igst: number;
        cess: number;
        itcEligibility: string | null;
    }[];
}
export interface VoucherTdsPayload {
    atdId: string;
    section: string;
    deducteeType: string | null;
    rate: number;
    rateSource: string;
    base: number;
    tax: number;
    challanNo: string | null;
    isReversal: boolean;
}
export interface VoucherLocks {
    editable: boolean;
    dayClosed: boolean;
    periodLocked: boolean;
    allocatedElsewhere: boolean;
}
export type StoredDraftPayload = Record<string, unknown>;
export interface VoucherPayload {
    header: VoucherHeaderPayload;
    rules: VoucherTypeRules;
    rights: VoucherRights;
    locks: VoucherLocks;
    legs: VoucherLegPayload[];
    allocations: VoucherAllocationPayload[];
    bills: VoucherBillPayload[];
    gstDoc: VoucherGstDocPayload | null;
    tds: VoucherTdsPayload[];
    draft: StoredDraftPayload | null;
}
export interface DraftSavedPayload {
    voucherId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    typeCode: string;
    status: 'DRAFT';
    created: boolean;
}
export interface CancelPayload {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    reversalVoucherId: string;
    reversalRefno: string | null;
    cancelledOn: string;
    billsClosed: number;
    allocationsReversed: number;
    gstDocCancelled: boolean;
    tdsReversed: number;
}
export interface DeletePayload {
    voucherId: string;
    accYear: string;
    deleted: true;
}
export interface AdjacentVoucher {
    voucherId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    typeCode: string;
    voucherRefno: string | null;
    date: string;
    status: VoucherStatus;
}
export interface AdjacentVoucherPayload {
    direction: 'prev' | 'next';
    fromVoucherId: string | null;
    voucher: AdjacentVoucher | null;
}
