import type { ModuleErrorDetail, ModuleErrorResponse } from '../../../common/utils/module-shared.utils';
import type { TillCountKind, TillCountOutcome, TillDayStatus, TillFloatMode, TillMovementKind, TillSessionStatus, TillSessionVarianceStatus, TillVarianceTreatment, TenderCloseMode } from './till-enum';
export interface TillErrorDetail extends ModuleErrorDetail {
    code?: string;
    event?: string;
    amount?: number;
    requiredRole?: string;
    channel?: string;
    [key: string]: unknown;
}
export type TillErrorResponse = ModuleErrorResponse<TillErrorDetail>;
export interface TillSuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}
export interface TillDayPayload {
    tbdId: string;
    tbdAccYear: string;
    tbdCompanyId: string;
    tbdBranchId: string;
    tbdBusinessDate: string;
    tbdStatus: TillDayStatus;
    tbdOpenedOn: string;
    tbdOpenedBy: string;
    tbdClosedOn: string | null;
    tbdZNo: number | null;
    tbdReopenCount: number;
    sessions: {
        status: TillSessionStatus;
        count: number;
    }[];
}
export interface TillCarriedFromPayload {
    sessionId: string;
    accYear: string;
    sessionNo: string;
    floatLeft: number;
}
export interface TillOpenCheckSessionPayload {
    sessionId: string;
    accYear: string;
    sessionNo: string;
    counterId: string;
    counterCode: string;
    operatorId: string;
    operatorName: string;
    deviceId: string;
    deviceName: string | null;
    openedOn: string;
    status: TillSessionStatus;
}
export interface TillOpenCheckCounterPayload {
    counterId: string;
    code: string;
    name: string;
    defaultFloat: number;
    carriedFrom: TillCarriedFromPayload | null;
}
export interface TillOpenCheckLinkedPayload extends TillOpenCheckCounterPayload {
    liveSessionId: string | null;
    inactive: boolean;
}
export interface TillOpenCheckBusyPayload {
    counterId: string;
    code: string;
    name: string;
    session: TillOpenCheckSessionPayload;
}
export interface TillOpenCheckPayload {
    requireSession: boolean;
    businessDay: {
        dayId: string | null;
        accYear: string;
        date: string;
        status: TillDayStatus | null;
        autoOpen: boolean;
    };
    linkedCounter: TillOpenCheckLinkedPayload | null;
    freeCounters: TillOpenCheckCounterPayload[];
    busyCounters: TillOpenCheckBusyPayload[];
    deviceSession: TillOpenCheckSessionPayload | null;
    userSessionElsewhere: TillOpenCheckSessionPayload | null;
    carriedFrom: TillCarriedFromPayload | null;
}
export interface TillSessionTenderPayload {
    tenderTypeId: number;
    tenderTypeName: string;
    tenderId: string | null;
    tenderName: string | null;
    closeMode: TenderCloseMode;
    openAmount: number | null;
    salesAmount: number | null;
    refundAmount: number | null;
    receiptAmount: number | null;
    paymentAmount: number | null;
    expenseAmount: number | null;
    movedIn: number | null;
    movedOut: number | null;
    paidFromBank: number | null;
    txnCount: number | null;
    noRefCount: number;
    expected: number | null;
    counted: number | null;
    variance: number | null;
}
export interface TillSessionPayload {
    tssId: string;
    tssAccYear: string;
    tssCompanyId: string;
    tssBranchId: string;
    tssDayId: string;
    tssBusinessDate: string;
    tssCounterId: string;
    counterCode: string;
    counterName: string;
    tssDeviceId: string;
    tssOperatorId: string;
    operatorName: string | null;
    tssSessionNo: string;
    tssDaySeq: number;
    tssStatus: TillSessionStatus;
    tssOpenedOn: string;
    tssFloatMode: TillFloatMode;
    tssPrevSessionId: string | null;
    tssFloatIssued: number;
    tssFloatCounted: number;
    tssFloatVariance: number;
    tssSuspendCount: number;
    tssSuspendedOn: string | null;
    tssBillingEndedOn: string | null;
    tssCountMode: 'BLIND' | 'OPEN' | null;
    tssCountPlace: 'COUNTER' | 'CASH_OFFICE' | null;
    tssCountAttempts: number;
    tssCountedOn: string | null;
    tssClosedOn: string | null;
    tssClosedBy: string | null;
    tssZNo: number | null;
    tssVarianceStatus: TillSessionVarianceStatus;
    totals: {
        billCount: number;
        returnCount: number;
        receiptCount: number;
        paymentCount: number;
        expenseCount: number;
        netSales: number | null;
        cashExpected: number | null;
        cashCounted: number | null;
        cashVariance: number | null;
        noncashExpected: number | null;
        noncashCounted: number | null;
        noncashVariance: number | null;
        handedOver: number;
        floatLeft: number;
    };
    expectedVisible: boolean;
    cashLimit: {
        state: 'NORMAL' | 'ALERT' | 'BLOCKED';
        gauge: number | null;
        alertLimit: number;
        blockLimit: number;
    } | null;
    tenders: TillSessionTenderPayload[];
    movements: TillMovementPayload[];
    variances: TillVariancePayload[];
}
export interface TillMovementPayload {
    tcmId: string;
    tcmAccYear: string;
    tcmKind: TillMovementKind;
    tcmDocNo: string;
    tcmDocDate: string;
    tcmAmount: number;
    tcmSafeId: string | null;
    tcmVoucherId: string | null;
    tcmStatus: 'POSTED' | 'VOIDED';
    tcmCreatedOn: string;
}
export interface TillMovementDetailPayload extends TillMovementPayload {
    safeName: string | null;
    tcmSessionId: string | null;
    sessionNo: string | null;
    sessionOperatorId: string | null;
    tcmLedgerId: string | null;
    tcmReasonId: string | null;
    reasonCode: string | null;
    reasonName: string | null;
    tcmRefNo: string | null;
    tcmRefDate: string | null;
    tcmPartyName: string | null;
    tcmBagNo: string | null;
    tcmSealNo: string | null;
    tcmDoneBy: string;
    tcmWitnessBy: string | null;
    tcmVoidedOn: string | null;
    tcmVoidedBy: string | null;
    tcmVoidReasonId: string | null;
    tcmNotes: string | null;
    counts: {
        tctId: string;
        tctKind: TillCountKind;
        tctTotalCounted: number;
        lines: {
            tenderTypeId: number;
            denominationId: string | null;
            faceValue: number;
            qty: number;
            amount: number;
        }[];
    }[];
}
export interface TillVariancePayload {
    tvrId: string;
    tvrAccYear: string;
    tvrStage: 'OPEN' | 'CLOSE';
    tvrTenderTypeId: number;
    tvrTenderId: string | null;
    tvrExpected: number;
    tvrCounted: number;
    tvrVariance: number;
    tvrTolerance: number;
    tvrTreatment: TillVarianceTreatment;
    tvrReasonId: string | null;
    tvrStatus: 'OPEN' | 'POSTED' | 'REVERSED';
    tvrVoucherId: string | null;
}
export interface TillCountResultPayload {
    tssId: string;
    tssAccYear: string;
    tctId: string;
    attemptNo: number;
    attemptsLeft: number;
    outcome: TillCountOutcome;
    slipCheckRequired: boolean;
    tssStatus: TillSessionStatus;
    variances: TillVariancePayload[] | null;
}
export interface TillCountLineInput {
    tenderTypeId: number;
    tenderId?: string | null;
    denominationId?: string | null;
    qty?: number;
    enteredAmount?: number;
    batchRef?: string | null;
}
export interface TillCountPayload {
    tctId: string;
    tctAccYear: string;
    tctKind: TillCountKind;
    tctAttemptNo: number;
    tctIsFinal: boolean;
    tctIsBlind: boolean;
    tctTotalCounted: number;
    tctCountedOn: string;
}
export interface TillCounterPayload {
    tcnId: string;
    tcnCompanyId: string;
    tcnBranchId: string;
    tcnCode: string;
    tcnName: string;
    tcnKind: string;
    tcnDrawerMode: string;
    tcnDeviceId: string | null;
    deviceName: string | null;
    tcnSafeId: string | null;
    safeName: string | null;
    tcnDefaultFloat: number;
    tcnCashAlertLimit: number;
    tcnCashBlockLimit: number;
    tcnZLastNo: number;
    tcnRequiresSession: boolean;
    tcnSortOrder: number;
    tcnRemarks: string | null;
    tcnIsActive: boolean;
    tcnCreatedOn: string;
    tcnModifiedOn: string | null;
}
export interface TillSafePayload {
    tsfId: string;
    tsfCompanyId: string;
    tsfBranchId: string;
    tsfCode: string;
    tsfName: string;
    tsfLedgerId: string;
    ledgerName: string | null;
    tsfInsuredLimit: number;
    tsfIsDefault: boolean;
    tsfRemarks: string | null;
    tsfIsActive: boolean;
    tsfCreatedOn: string;
    tsfModifiedOn: string | null;
}
export interface TillReasonPayload {
    trsId: string;
    trsCompanyId: string | null;
    trsCategory: string;
    trsCode: string;
    trsName: string;
    trsLedgerId: string | null;
    ledgerName: string | null;
    trsNeedsNote: boolean;
    trsNeedsRef: boolean;
    trsMaxAmount: number;
    trsSortOrder: number;
    trsIsActive: boolean;
    shipped: boolean;
}
export interface TillDenominationPayload {
    tdnId: string;
    tdnCompanyId: string | null;
    tdnCurrency: string;
    tdnValue: number;
    tdnKind: 'NOTE' | 'COIN';
    tdnLabel: string;
    tdnBundleQty: number;
    tdnSortOrder: number;
    tdnValidTo: string | null;
    tdnIsActive: boolean;
    shipped: boolean;
}
export interface TillApprovalRulePayload {
    tarId: string;
    tarCompanyId: string | null;
    tarBranchId: string | null;
    tarEventCode: string;
    tarMode: string;
    tarThresholdAmount: number;
    tarThresholdCount: number;
    tarThresholdPercent: number;
    tarChannel: string;
    tarMinRole: string;
    tarTwoPerson: boolean;
    tarAllowSelf: boolean;
    tarBlocksTill: boolean;
    tarExpireMinutes: number;
    tarEffectiveFrom: string;
    tarRemarks: string | null;
    tarIsActive: boolean;
    shipped: boolean;
}
export interface TillApprovalNeed {
    event: string;
    ruleId: string;
    mode: string;
    threshold: number;
    amount: number;
    minRole: string;
    channel: string;
    twoPerson: boolean;
    blocksTill: boolean;
    enforced: false;
}
export interface TillApprovalAuthorityPayload {
    taaId: string;
    taaUserId: string;
    userName: string | null;
    taaCompanyId: string | null;
    taaBranchId: string | null;
    taaRole: string;
    taaEventCode: string | null;
    taaMaxAmount: number | null;
    taaCanRemote: boolean;
    taaValidFrom: string;
    taaValidTo: string | null;
    taaRemarks: string | null;
    taaIsActive: boolean;
}
export interface TillDeletePayload {
    id: string;
    deleted: true;
}
export interface TillEventBatchPayload {
    accepted: number;
    duplicates: number;
}
export interface TillSlipCheckPayload {
    tssId: string;
    tssSessionNo: string;
    tenderId: string;
    tenderName: string | null;
    expected: number | null;
    batchTotal: number | null;
    batchRef: string | null;
    slipCount: number | null;
    difference: number | null;
    rows: {
        tdId: string;
        tdAccYear: string;
        time: string;
        srcDocType: string;
        srcDocId: string;
        docRefno: string | null;
        drCr: 'DR' | 'CR';
        amount: number;
        authCode: string | null;
        cardLast4: string | null;
        refNo: string | null;
    }[];
}
export interface TillSlipCheckResultPayload {
    tssId: string;
    tenderId: string;
    ticked: number;
    noSlip: number;
    slipsWithoutRow: number;
    amountDiffers: number;
}
