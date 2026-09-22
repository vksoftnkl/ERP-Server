import { SaleBill, SaleBillItem } from '@prisma/client';
import { ChargeDocType } from '../../../master/charge-master/types/charge-enum';
import type { ChargeDetailPayload, ChargeDocumentAudit } from '../../../master/charge-detail/types/charge-detail-api.types';
import { TenderDrCr, TenderSrcDocType, TenderSrcModule } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import type { TenderDetailPayload, TenderDocumentAudit } from '../../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { TxnStatusDocType, TxnStatusSrcModule } from '../../../../common/txn-status-log/txn-status-log.helper';
import type { TenderTempCreditDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import type { LocksBlock, PostingBlock, RightsBlock } from '../../posting/types/posting.types';
import type { TransportBandRow } from '../../posting/transport-band.service';
export declare const BILL_CHARGE_DOC_TYPE = ChargeDocType.INVOICE;
export declare const BILL_CHARGE_AUDIT: ChargeDocumentAudit;
export declare const BILL_TENDER_SRC_MODULE = TenderSrcModule.SALES;
export declare const BILL_TENDER_SRC_DOC_TYPE = TenderSrcDocType.SALE_BILL;
export declare const BILL_TENDER_DR_CR = TenderDrCr.DR;
export declare const BILL_TENDER_AUDIT: TenderDocumentAudit;
export declare const BILL_STATUS_SRC_MODULE = TxnStatusSrcModule.SALES;
export declare const BILL_STATUS_SRC_DOC_TYPE = TxnStatusDocType.SALE_BILL;
export declare const BILL_STATUS_POSTED = "POSTED";
export declare const BILL_STATUS_DRAFT = "DRAFT";
export declare const BILL_STATUS_CANCELLED = "CANCELLED";
export type BillPayload = Omit<SaleBill, 'sbCreatedOn' | 'sbModifiedOn' | 'sbBillDatetime' | 'sbSyncDate' | 'sbBillSlno'> & {
    sbCreatedOn?: string;
    sbModifiedOn?: string | null;
    sbBillDatetime?: string;
    sbSyncDate?: string | null;
    sbBillSlno: string | null;
    items?: BillItemPayload[];
    charges?: BillChargePayload[];
    tenders?: BillTenderPayload[];
    posting?: PostingBlock;
    locks?: LocksBlock;
    rights?: RightsBlock;
    sources?: BillSourceSummary[];
    tempCredits?: BillTempCreditSummary[];
    adjustments?: BillAdjustmentSummary[];
    transport?: TransportBandRow | null;
    sbShipAddrId?: string | null;
    sbShipName?: string | null;
    sbShipAddr?: string | null;
    sbShipPlace?: string | null;
    sbShipPin?: string | null;
    sbShipPhone?: string | null;
    sbShipStcd?: string | null;
    sbShipGstin?: string | null;
    sbDispatchGodownId?: string | null;
    sbDispatchBranchId?: string | null;
    sbTransportMode?: string | null;
    sbTransporterId?: string | null;
    sbTransporterName?: string | null;
    sbTransporterGstin?: string | null;
    sbLrNo?: string | null;
    sbLrDate?: string | null;
    sbDistanceKm?: number | null;
};
export interface BillSourceSummary {
    kind: 'DC' | 'ORDER' | 'QUOTATION';
    docId: string;
    accYear: string;
    refno: string | null;
    date: string | null;
    lines: number;
    takenQty: number;
    openQtyAfter: number | null;
}
export interface BillTempCreditSummary {
    atcId: string;
    name: string;
    mobile: string;
    balance: number;
    dueDate: string | null;
    status: string;
}
export interface BillAdjustmentSummary {
    againstBillId: string;
    againstBillAccYear: string;
    refno: string | null;
    amount: number;
    adjType: string;
}
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
    sbiAllowNegativeStock?: boolean | null;
};
export type BillChargePayload = ChargeDetailPayload;
export type BillTenderPayload = TenderDetailPayload & {
    tempCredit?: TenderTempCreditDto | null;
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
