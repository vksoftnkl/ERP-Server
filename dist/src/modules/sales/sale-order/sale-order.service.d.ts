import { Prisma, SaleOrder, SaleOrderItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { SaleOrderCancelLinesResult, SaleOrderFulfilmentResult, SaleOrderLineRef, SaleOrderPayload, SaleOrderSrcDocPendingAmount } from './types/sale-order-api.types';
import { SalesContextService } from '../posting/sales-context.service';
import { CancelSaleOrderLinesDto } from './dto/cancel-sale-order-lines.dto';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { SalesWriteClient } from "../../../common/utils/module-service.utils";
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare const SALE_ORDER_TABLE_NAME = "sale_order";
export declare const SALE_ORDER_AUDIT_SCREEN_NAME = "Sale Order";
export declare const SALE_ORDER_TERMINAL_STATUSES: readonly string[];
export declare function assertSaleOrderNotTerminal(order: Pick<SaleOrder, 'soStatus'>): void;
export declare function finishedOrderHoldRelease(order: Pick<SaleOrder, 'soDeliveryHold'>, endStatus: string, cause: 'cancelled' | 'closed' | 'completed' | 'deleted', actor: string, now: Date): {
    data: {
        soDeliveryHold: false;
        soDeliveryHoldReason: string;
        soDeliveryHoldBy: string;
        soDeliveryHoldOn: Date;
    };
    remarks: string;
} | null;
type SaleOrderWriteClient = SalesWriteClient;
export interface SaleOrderSaveInTxOptions {
    revision?: boolean;
}
export interface SaleOrderAmounts {
    soPendingAmt: Prisma.Decimal;
    soCancelledAmt: Prisma.Decimal;
    soBilledAmt: Prisma.Decimal;
}
export declare class SaleOrderService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly chargeDetailService;
    private readonly tenderDetailService;
    private readonly salesContext;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, chargeDetailService: ChargeDetailService, tenderDetailService: TenderDetailService, salesContext: SalesContextService);
    save(saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderPayload>;
    prepareSave(saveOrderDto: SaveSaleOrderDto): void;
    private signedInActor;
    private assertAmendRightToEdit;
    throwIfDuplicate(error: unknown): void;
    getById(soId: string, soCompanyId: string, soBranchId: string, soAccYear: string, client?: SaleOrderWriteClient): Promise<SaleOrderPayload>;
    getSrcDocPendingAmount(ablSrcDocType: string, ablSrcDocId: string, ablSrcAccYear: string): Promise<SaleOrderSrcDocPendingAmount>;
    softDelete(soId: string, soCompanyId: string, soBranchId: string, soAccYear: string): Promise<{
        soId: string;
        deleted: true;
    }>;
    cancelOpenLines(srcModule: string, srcDocId: string, srcAccYear: string, cancelDto: CancelSaleOrderLinesDto): Promise<SaleOrderCancelLinesResult>;
    cancelOpenLinesForRefs(tx: Prisma.TransactionClient, refs: SaleOrderLineRef[], cancelReason: string | null | undefined, actor: string, now: Date): Promise<SaleOrderCancelLinesResult[]>;
    cancelOrderOpenLines(tx: Prisma.TransactionClient, request: {
        order: SaleOrder;
        srcAccYear: string;
        targetLineId: string | null;
        cancelReason?: string | null;
        actor: string;
        now: Date;
    }): Promise<SaleOrderCancelLinesResult>;
    orderAmountsOf(lines: readonly SaleOrderItem[]): SaleOrderAmounts;
    private restateOrderAmounts;
    private summariseOrderLines;
    private deriveLineStatus;
    private deriveOrderStatus;
    syncOrderFulfilment(tx: Prisma.TransactionClient, request: {
        refs: SaleOrderLineRef[];
        reopenRemark?: string;
    }, actor: string, now: Date): Promise<SaleOrderFulfilmentResult[]>;
    private resolveOrderRefs;
    private syncOneOrderFulfilment;
    private logStatusStep;
    private createOrder;
    createOrderInTx(tx: Prisma.TransactionClient, saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderPayload>;
    writeRevision(tx: Prisma.TransactionClient, order: Pick<SaleOrder, 'soId' | 'soCompanyId' | 'soBranchId' | 'soAccYear'>, before: SaleOrderPayload | null, actor: string, notes: string): Promise<{
        revNo: number;
        after: SaleOrderPayload;
    }>;
    private updateOrder;
    updateOrderInTx(tx: Prisma.TransactionClient, saveOrderDto: SaveSaleOrderDto, options?: SaleOrderSaveInTxOptions): Promise<SaleOrderPayload>;
    private syncItems;
    private softDeleteItems;
    private syncAdvanceVoucher;
    private withChequeDetails;
    private describeDuplicate;
    private ensureOrderValuesAreAllowed;
    private ensureAdvanceRollupsAreConsistent;
    private heldAdvanceBalance;
    private restateAdvanceRollups;
    private advanceRollupsFromLive;
    private deriveAdvanceStatus;
    private deriveAdvanceBalance;
    private ensureOrderItemValuesAreAllowed;
    private applyDerivedItemQuantities;
    private requireItemField;
    private toChargeScope;
    private toTenderScope;
    private applyOptionalFields;
    private resolveGodowns;
    private resolveActorNames;
    private resolveDisplayNames;
    private toPayload;
    private toItemPayload;
    private withChargeNames;
    private withTenderNames;
}
export {};
