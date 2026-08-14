import { SaleBill, SaleBillItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import type { ChargeDetailPayload, ChargeDocumentAudit } from '../../../master/charge-detail/types/charge-detail-api.types';
import { TenderDrCr, TenderSrcDocType, TenderSrcModule } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import type { TenderDetailPayload, TenderDocumentAudit } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { TxnStatusDocType, TxnStatusSrcModule } from '../../../../common/txn-status-log/txn-status-log.helper';
import type { SaleOrderCancelLinesResult } from '../../sale-order/types/sale-order-api.types';
export declare const BILL_CHARGE_DOC_TYPE = ChargeDocType.INVOICE;
export declare const BILL_CHARGE_AUDIT: ChargeDocumentAudit;
export declare const BILL_TENDER_SRC_MODULE = TenderSrcModule.SALES;
export declare const BILL_TENDER_SRC_DOC_TYPE = TenderSrcDocType.SALE_BILL;
export declare const BILL_TENDER_DR_CR = TenderDrCr.DR;
export declare const BILL_TENDER_AUDIT: TenderDocumentAudit;
export declare const BILL_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export declare const BILL_STATUS_SRC_DOC_TYPE = TxnStatusDocType.SALE_BILL;
export declare const BILL_STATUS_POSTED = "POSTED";
export type BillPayload = Omit<SaleBill, 'sbCreatedOn' | 'sbModifiedOn' | 'sbBillDatetime' | 'sbSyncDate' | 'sbBillSlno'> & {
    sbCreatedOn?: string;
    sbModifiedOn?: string | null;
    sbBillDatetime?: string;
    sbSyncDate?: string | null;
    sbBillSlno: string | null;
    items?: BillItemPayload[];
    charges?: BillChargePayload[];
    tenders?: BillTenderPayload[];
};
export type BillItemPayload = Omit<SaleBillItem, 'sbiCreatedOn' | 'sbiModifiedOn' | 'sbiSyncDate'> & {
    sbiCreatedOn?: string;
    sbiModifiedOn?: string | null;
    sbiSyncDate?: string | null;
    sbiItemName?: string | null;
    sbiUnitName?: string | null;
    sbiDecimalCount?: number | null;
    sbiGroupId?: string | null;
    sbiBrandId?: string | null;
    sbiSectionId?: string | null;
    sbiCategoryId?: string | null;
    sbiGodownName?: string | null;
};
export type BillChargePayload = ChargeDetailPayload;
export type BillTenderPayload = TenderDetailPayload;
export type BillCancelResult = {
    sbId: string;
    cancelled: true;
    remarks: string;
    username: string;
    cancelledOn: string;
    orders: SaleOrderCancelLinesResult[];
};
export type BillErrorDetail = {
    field: string;
    message: string;
};
export type BillErrorResponse = {
    statusCode?: number;
    success: false;
    message: string;
    errors: BillErrorDetail[];
};
export type BillSuccessResponse<T> = {
    success: true;
    message: string;
    data: T;
};
