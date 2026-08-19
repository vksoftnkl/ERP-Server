import { SaleOrder, SaleOrderItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import type { ChargeDetailPayload, ChargeDocumentAudit } from '../../../master/charge-detail/types/charge-detail-api.types';
import { TenderDrCr, TenderSrcDocType, TenderSrcModule } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { TxnStatusDocType, TxnStatusSrcModule } from '../../../../common/txn-status-log/txn-status-log.helper';
import type { TenderDetailPayload, TenderDocumentAudit } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
export declare const SALE_ORDER_CHARGE_DOC_TYPE = ChargeDocType.ORDER;
export declare const SALE_ORDER_CHARGE_AUDIT: ChargeDocumentAudit;
export declare const SALE_ORDER_TENDER_SRC_MODULE = TenderSrcModule.SALES;
export declare const SALE_ORDER_TENDER_SRC_DOC_TYPE = TenderSrcDocType.SALES_ORDER;
export declare const SALE_ORDER_TENDER_DR_CR = TenderDrCr.DR;
export declare const SALE_ORDER_TENDER_AUDIT: TenderDocumentAudit;
export declare const SALE_ORDER_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export declare const SALE_ORDER_STATUS_SRC_DOC_TYPE = TxnStatusDocType.SALES_ORDER;
export declare const SALE_ORDER_DOC_TYPES: readonly ["SALES_ORDER", "BOOKING", "CUSTOM_ORDER"];
export declare const SALE_ORDER_CANCEL_SRC_MODULES: readonly string[];
export declare const SALE_ORDER_SRC_DOC_TYPE: string;
export type SaleOrderLineRef = {
    srcDocId: string;
    srcAccYear: string;
    soLineNo: number | null;
    fields: SaleOrderSrcDocFields;
};
export type SaleOrderSrcDocFields = {
    docId: string;
    accYear: string;
    lineNo?: string;
};
export type SaleOrderFulfilledLine = {
    soiId: string;
    soiLineNo: number;
    soiNetQty: number;
    soiDeliveredQty: number;
    soiCancelledQty: number;
    soiPendingQty: number;
    soiBilledAmt: number;
    soiLineStatus: string;
};
export type SaleOrderFulfilmentResult = {
    soId: string;
    soAccYear: string;
    soStatus: string;
    soFulfilStatus: string;
    lines: SaleOrderFulfilledLine[];
};
export type SaleOrderPayload = Omit<SaleOrder, 'soCreatedOn' | 'soModifiedOn' | 'soOrderDatetime' | 'soSyncDate' | 'soOrderSlno'> & {
    soCreatedOn?: string;
    soModifiedOn?: string | null;
    soOrderDatetime?: string;
    soSyncDate?: string | null;
    soOrderSlno: string | null;
    soCompanyName?: string | null;
    soBranchName?: string | null;
    soSalesmanName?: (string | null)[] | null;
    items?: SaleOrderItemPayload[];
    charges?: SaleOrderChargePayload[];
    tenders?: SaleOrderTenderPayload[];
};
export type SaleOrderItemPayload = Omit<SaleOrderItem, 'soiCreatedOn' | 'soiModifiedOn' | 'soiSyncDate'> & {
    soiCreatedOn?: string;
    soiModifiedOn?: string | null;
    soiSyncDate?: string | null;
    soiItemName?: string | null;
    soiUnitName?: string | null;
    soiDecimalCount?: number | null;
    soiGroupId?: string | null;
    soiBrandId?: string | null;
    soiSectionId?: string | null;
    soiCategoryId?: string | null;
    soiGodownName?: string | null;
    soiCompanyName?: string | null;
    soiBranchName?: string | null;
    soiSalesmanName?: string | null;
};
export type SaleOrderChargePayload = ChargeDetailPayload & {
    cdCompName?: string | null;
    cdBranchName?: string | null;
};
export type SaleOrderTenderPayload = TenderDetailPayload & {
    tdCompanyName?: string | null;
    tdPartyLedgerName?: string | null;
    tdUserName?: string | null;
};
export type SaleOrderErrorDetail = {
    field: string;
    message: string;
};
export type SaleOrderErrorResponse = {
    statusCode?: number;
    success: false;
    message: string;
    errors: SaleOrderErrorDetail[];
};
export type SaleOrderSuccessResponse<T> = {
    success: true;
    message: string;
    data: T;
};
export type SaleOrderCancelledLine = {
    soiId: string;
    soiLineNo: number;
    soiCancelledQty: number;
    soiLineStatus: string;
};
export type SaleOrderCancelLinesResult = {
    soId: string;
    soAccYear: string;
    soStatus: string;
    soFulfilStatus: string;
    cancelledLines: number;
    cancelledQty: number;
    soCancelledAmt: number;
    soPendingAmt: number;
    lines: SaleOrderCancelledLine[];
};
export type SaleOrderSrcDocPendingAmount = {
    ablPendingAmount: number;
};
