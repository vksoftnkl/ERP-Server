import { Prisma, TxnStatusLog } from '@prisma/client';
export declare enum TxnStatusSrcModule {
    SALES = "SALES",
    PURCHASE = "PURCHASE",
    INVENTORY = "INVENTORY",
    ACCOUNTS = "ACCOUNTS",
    POS = "POS",
    SERVICE = "SERVICE",
    OTHER = "OTHER"
}
export declare enum TxnStatusDocType {
    QUOTATION = "QUOTATION",
    SALES_ORDER = "SALES_ORDER",
    DELIVERY_CHALLAN = "DELIVERY_CHALLAN",
    DC_RETURN = "DC_RETURN",
    SALE_BILL = "SALE_BILL",
    SALE_RETURN = "SALE_RETURN",
    PURCHASE_ORDER = "PURCHASE_ORDER",
    PURCHASE_BILL = "PURCHASE_BILL",
    PURCHASE_RETURN = "PURCHASE_RETURN",
    STOCK_TRANSFER = "STOCK_TRANSFER",
    STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT",
    OPENING_STOCK = "OPENING_STOCK",
    PHYSICAL_STOCK = "PHYSICAL_STOCK",
    RECEIPT = "RECEIPT",
    PAYMENT = "PAYMENT",
    JOURNAL = "JOURNAL",
    EXPENSE = "EXPENSE",
    CHEQUE_RECEIVED = "CHEQUE_RECEIVED",
    CHEQUE_ISSUED = "CHEQUE_ISSUED",
    TEMP_CREDIT = "TEMP_CREDIT",
    OTHER = "OTHER"
}
export declare enum TxnStatusEvent {
    CREATED = "CREATED",
    SUBMITTED = "SUBMITTED",
    SENT = "SENT",
    APPROVED = "APPROVED",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    EXPIRED = "EXPIRED",
    CONVERTED = "CONVERTED",
    POSTED = "POSTED",
    UNPOSTED = "UNPOSTED",
    AMENDED = "AMENDED",
    CANCELLED = "CANCELLED",
    CLOSED = "CLOSED",
    REOPENED = "REOPENED",
    DELETED = "DELETED",
    STATUS_CHANGED = "STATUS_CHANGED",
    PARTIAL = "PARTIAL",
    SETTLED = "SETTLED",
    WRITTEN_OFF = "WRITTEN_OFF"
}
export declare enum TxnStatusNotifyChannel {
    SMS = "SMS",
    WHATSAPP = "WHATSAPP",
    EMAIL = "EMAIL",
    NONE = "NONE"
}
export interface TxnStatusLogEntry {
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    accYear: string;
    srcModule: TxnStatusSrcModule;
    srcDocType: TxnStatusDocType;
    srcDocId: string;
    srcDocRefno?: string | null;
    event: TxnStatusEvent;
    fromStatus?: string | null;
    toStatus: string;
    changedOn?: Date;
    changedBy: string;
    remarks?: string | null;
    deviceId?: string | null;
    sessionId?: string | null;
    notifyChannel?: TxnStatusNotifyChannel | null;
    notifiedOn?: Date | null;
    notifyRef?: string | null;
}
export declare function statusActorOf(actor: string, requestUserId: string | null | undefined): string;
export declare function appendTxnStatusLog(tx: Prisma.TransactionClient, entry: TxnStatusLogEntry): Promise<TxnStatusLog>;
