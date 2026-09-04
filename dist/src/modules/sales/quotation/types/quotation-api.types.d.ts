import { TransactionChargeDetail, SaleQuotation, SaleQuotationItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import { TxnStatusDocType, TxnStatusSrcModule } from '../../../../common/txn-status-log/txn-status-log.helper';
export declare const QUOTATION_CHARGE_DOC_TYPE = ChargeDocType.QUOTATION;
export declare const QUOTATION_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export declare const QUOTATION_STATUS_SRC_DOC_TYPE = TxnStatusDocType.QUOTATION;
export type QuotationPayload = Omit<SaleQuotation, 'sqCreatedOn' | 'sqModifiedOn' | 'sqQuoteDatetime' | 'sqSyncDate' | 'sqQuoteSlno'> & {
    sqCreatedOn?: string;
    sqModifiedOn?: string | null;
    sqQuoteDatetime?: string;
    sqSyncDate?: string | null;
    sqQuoteSlno: string;
    sqCustAreaName?: string | null;
    sqCustAreaDistanceKm?: number | null;
    sqSalesmanName?: string | null;
    sqAgentName?: string | null;
    items?: QuotationItemPayload[];
    charges?: QuotationChargePayload[];
};
export type QuotationItemPayload = Omit<SaleQuotationItem, 'sqiCreatedOn' | 'sqiModifiedOn' | 'sqiSyncDate'> & {
    sqiCreatedOn?: string;
    sqiModifiedOn?: string | null;
    sqiSyncDate?: string | null;
    sqiItemName?: string | null;
    sqiUnitName?: string | null;
    sqiDecimalCount?: number | null;
    sqiBatchConfig?: number | null;
    sqiGroupId?: string | null;
    sqiBrandId?: string | null;
    sqiSectionId?: string | null;
    sqiCategoryId?: string | null;
};
export type QuotationChargePayload = Omit<TransactionChargeDetail, 'cdCreatedOn' | 'cdModifiedOn' | 'cdSyncDate' | 'cdVoucherNo'> & {
    cdCreatedOn?: string;
    cdModifiedOn?: string | null;
    cdSyncDate?: string | null;
    cdVoucherNo?: string | null;
};
export type QuotationErrorDetail = {
    field: string;
    message: string;
};
export type QuotationErrorResponse = {
    statusCode?: number;
    success: false;
    message: string;
    errors: QuotationErrorDetail[];
};
export type QuotationSuccessResponse<T> = {
    success: true;
    message: string;
    data: T;
};
