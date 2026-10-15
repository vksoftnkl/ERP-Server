import type { ModuleErrorDetail, ModuleErrorResponse } from '../../../common/utils/module-shared.utils';
import type { TillCashReceiptState, TillCloseCheckCode, TillCloseCheckTone, TillCountKind, TillCountOutcome, TillDayStatus, TillFloatMode, TillHandoverReceipt, TillMovementKind, TillReceiptStatus, TillRemitMode, TillRemitStatus, TillSafeGapOutcome, TillSessionStatus, TillSessionVarianceStatus, TillVarianceDecision, TillVarianceStage, TillVarianceTreatment, TenderCloseMode } from './till-enum';
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
    tbdClosedBy: string | null;
    tbdClosedByName: string | null;
    tbdZNo: number | null;
    tbdReopenCount: number;
    totals: {
        sessionCount: number;
        billCount: number;
        netSales: number;
        cashExpected: number;
        cashCounted: number;
        cashVariance: number;
        noncashVariance: number;
    };
    tbdExceptionCount: number;
    tbdCloseApprovalId: string | null;
    tbdPrintCount: number;
    tbdNotes: string | null;
    sessions: {
        status: TillSessionStatus;
        count: number;
    }[];
    handoverReceipt: TillHandoverReceipt;
    awaitingReceipt: {
        thisDay: number;
        earlierDays: number;
        oldestOn: string | null;
    };
    safe: {
        opening: number;
        expected: number;
        counted: number | null;
        remitted: number;
    };
}
export interface TillCloseCheckItem {
    code: TillCloseCheckCode;
    tone: TillCloseCheckTone;
    count: number;
    detail: string;
    sessionIds: string[];
}
export interface TillDayCloseCheckPayload {
    tbdId: string;
    tbdAccYear: string;
    tbdBusinessDate: string;
    tbdStatus: TillDayStatus;
    items: TillCloseCheckItem[];
    canClose: boolean;
    canCloseWithException: boolean;
}
export interface TillDayClosePayload {
    day: TillDayPayload;
    zNo: number;
    tapId: string | null;
    closedOver: TillCloseCheckItem[];
    forceClosed: {
        tssId: string;
        tssAccYear: string;
        sessionNo: string;
    }[];
}
export interface TillDayReopenPayload {
    day: TillDayPayload;
    tapId: string;
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
    dropSafeName: string | null;
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
    tssForceClosed: boolean;
    tssForceReasonId: string | null;
    tssReopenCount: number;
    tssPrintCount: number;
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
    receiptState: TillCashReceiptState;
    cashAwaiting: number;
    receivedBy: string | null;
    receivedByName: string | null;
    receivedOn: string | null;
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
    tcmReceiptStatus: TillReceiptStatus | null;
    tcmReceivedAmount: number | null;
    tcmReceivedOn: string | null;
}
export interface TillSupervisorPayload {
    userId: string;
    loginName: string;
    fullName: string | null;
    hasPin: boolean;
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
    tcmWitnessVerifiedOn: string | null;
    tcmVoidedOn: string | null;
    tcmVoidedBy: string | null;
    tcmVoidReasonId: string | null;
    tcmNotes: string | null;
    tcmReceivedBy: string | null;
    tcmReceiveVoucherId: string | null;
    tcmRemitMode: TillRemitMode | null;
    tcmRemitStatus: TillRemitStatus | null;
    tcmCitAgency: string | null;
    tcmBankDate: string | null;
    tcmBankRef: string | null;
    tcmBankAmount: number | null;
    tcmConfirmedBy: string | null;
    tcmConfirmedOn: string | null;
    tcmConfirmVoucherId: string | null;
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
    tvrStage: TillVarianceStage;
    tvrMovementId: string | null;
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
    tvrApprovalId: string | null;
    tvrDecidedBy: string | null;
    tvrRecoveryLedgerId: string | null;
}
export interface TillForceClosePayload {
    outcome: 'CLOSED' | 'SENT_FOR_APPROVAL';
    tapId: string;
    tctId: string;
    session: TillSessionPayload;
}
export interface TillSessionReopenPayload {
    tapId: string;
    reversalVoucherIds: string[];
    session: TillSessionPayload;
}
export type TillXReportPayload = TillSessionPayload & {
    xNo: number;
    xReadOn: string;
};
export interface TillVarianceDecisionPayload {
    tapId: string;
    decision: TillVarianceDecision;
    event: string;
    amount: number;
    requiredRole: string;
    approverRole: string;
    channel: 'COUNTER' | 'REMOTE';
    treatment: TillVarianceTreatment | null;
    tcmId: string | null;
    session: TillSessionPayload;
}
export interface TillCashApprovalMovementPayload {
    tcmId: string;
    tcmAccYear: string;
    tcmKind: TillMovementKind;
    tcmDocNo: string;
    handedOver: number;
    received: number;
    receiveVoucherId: string | null;
    receiveVoucherNo: string | null;
}
export interface TillCashApprovalPayload {
    tssId: string;
    tssAccYear: string;
    sessionNo: string;
    handedOver: number;
    received: number;
    difference: number;
    outcome: 'APPROVED' | 'WITHIN_TOLERANCE' | 'DECIDED' | 'SENT_FOR_APPROVAL';
    tvrId: string | null;
    tcmId: string | null;
    treatment: TillVarianceTreatment | null;
    tapId: string | null;
    varianceVoucherId: string | null;
    varianceVoucherNo: string | null;
    receivedOn: string;
    movements: TillCashApprovalMovementPayload[];
    session: TillSessionPayload;
}
export interface TillAwaitingReceiptPayload {
    tcmId: string;
    tcmAccYear: string;
    tcmKind: TillMovementKind;
    tcmDocNo: string;
    tcmDocDate: string;
    handedOverOn: string;
    ageMinutes: number;
    bagNo: string | null;
    sealNo: string | null;
    safeId: string | null;
    safeName: string | null;
    tssId: string;
    sessionNo: string;
    sessionStatus: TillSessionStatus;
    counterCode: string;
    counterName: string;
    cashierId: string;
    cashierName: string | null;
    handedOverBy: string;
    canReceive: boolean;
}
export interface TillReceivedPayload {
    tcmId: string;
    tcmAccYear: string;
    tcmKind: TillMovementKind;
    tcmDocNo: string;
    tssId: string;
    sessionNo: string;
    handedOver: number;
    received: number;
    difference: number;
    outcome: 'RECEIVED' | 'WITHIN_TOLERANCE' | 'SENT_FOR_APPROVAL';
    tvrId: string | null;
    receiveVoucherId: string | null;
    receivedOn: string;
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
    tsfIsDropSafe: boolean;
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
export interface TillRemittancePayload {
    tcmId: string;
    tcmAccYear: string;
    docNo: string;
    docDate: string;
    safeId: string;
    safeName: string | null;
    mode: TillRemitMode;
    status: TillRemitStatus;
    amount: number;
    bankLedgerId: string;
    bankName: string | null;
    bagNo: string | null;
    sealNo: string | null;
    citAgency: string | null;
    slipNo: string | null;
    slipDate: string | null;
    ageDays: number;
    doneBy: string;
    createdOn: string;
}
export interface TillSafeStatePayload {
    safeId: string;
    code: string;
    name: string;
    ledgerId: string;
    ledgerName: string | null;
    isDefault: boolean;
    isDropSafe: boolean;
    isActive: boolean;
    insuredLimit: number;
    overInsured: boolean;
    ledgerShared: boolean;
    openingFrom: 'COUNT' | 'BOOK' | 'ZERO';
    opening: number | null;
    in: {
        handOvers: number;
        drops: number;
        pickups: number;
        transfersIn: number;
        receipts: number;
        total: number;
    } | null;
    out: {
        floatIssues: number;
        topUps: number;
        remittances: number;
        transfersOut: number;
        payments: number;
        total: number;
    } | null;
    exchanges: number;
    expected: number | null;
    bookBalance: number | null;
    drift: number | null;
    lastCount: {
        tctId: string;
        tctAccYear: string;
        countedOn: string;
        countedBy: string;
        countedByName: string | null;
        witnessBy: string | null;
        counted: number | null;
        expected: number | null;
        difference: number | null;
    } | null;
    countedToday: boolean;
    inTransit: {
        count: number;
        amount: number;
    };
    pendingGaps: {
        tvrId: string;
        tvrAccYear: string;
        stage: TillVarianceStage;
        variance: number;
    }[];
}
export interface TillSafeBalancePayload {
    companyId: string;
    branchId: string;
    businessDate: string;
    figuresVisible: boolean;
    safes: TillSafeStatePayload[];
    inTransit: TillRemittancePayload[];
}
export interface TillSafeCountPayload {
    tctId: string;
    tctAccYear: string;
    safeId: string;
    safeName: string;
    tbdId: string;
    businessDate: string;
    countedOn: string;
    counted: number;
    expected: number;
    difference: number;
    outcome: TillSafeGapOutcome;
    tvrId: string | null;
    treatment: TillVarianceTreatment | null;
    tapId: string | null;
    varianceVoucherId: string | null;
    varianceVoucherNo: string | null;
    witnessBy: string | null;
    safe: TillSafeStatePayload;
}
export interface TillSafeDecisionPayload {
    tvrId: string;
    tvrAccYear: string;
    stage: TillVarianceStage;
    safeId: string;
    safeName: string | null;
    expected: number;
    counted: number;
    variance: number;
    treatment: TillVarianceTreatment;
    tapId: string;
    secondBy: string | null;
    varianceVoucherId: string | null;
    varianceVoucherNo: string | null;
    decidedOn: string;
}
export interface TillRemitPayload {
    movement: TillMovementDetailPayload;
    tapId: string | null;
    countId: string | null;
    safe: TillSafeStatePayload;
}
export interface TillRemitConfirmPayload {
    tcmId: string;
    tcmAccYear: string;
    docNo: string;
    sent: number;
    credited: number;
    difference: number;
    outcome: TillSafeGapOutcome;
    confirmVoucherId: string | null;
    confirmVoucherNo: string | null;
    tvrId: string | null;
    treatment: TillVarianceTreatment | null;
    tapId: string | null;
    varianceVoucherId: string | null;
    varianceVoucherNo: string | null;
    movement: TillMovementDetailPayload;
}
