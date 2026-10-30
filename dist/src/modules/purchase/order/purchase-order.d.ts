import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { PurchaseChargeDto } from '../invoice/dto/save-purchase-invoice.dto';
export declare const PURCHASE_ORDER_MENU_ID = 23;
export declare class PurchaseOrderLineDto {
    lineNo: number;
    itemId: string;
    uomId: string;
    qty: number;
    freeQty?: number;
    rate: number;
    discPct?: number;
    schPct?: number;
    taxId?: string;
    mrp?: number;
    weight?: number;
    remarks?: string;
    lineId?: string;
}
export declare class PurchaseOrderHeaderDto {
    poId?: string;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    supplierId: string;
    docDate: string;
    expectedDate?: string;
    godownId?: string;
    creditDays?: number;
    agentId?: string | null;
    contact?: string;
    termsText?: string;
    termsId?: string | null;
    remarks?: string;
    post?: boolean;
    amendReason?: string;
}
export declare class SavePurchaseOrderDto {
    header: PurchaseOrderHeaderDto;
    lines: PurchaseOrderLineDto[];
    charges?: PurchaseChargeDto[];
}
export declare class PurchaseOrderRefDto {
    poId: string;
    accYear: string;
}
export declare class PurchaseOrderReasonDto extends PurchaseOrderRefDto {
    reason: string;
    lineIds?: string[];
}
export declare class PurchaseOrderApproveDto extends PurchaseOrderRefDto {
    approve?: boolean;
    reason?: string;
}
export declare class ClonePurchaseOrderDto extends PurchaseOrderRefDto {
    deviceId: string;
    toAccYear?: string;
    docDate?: string;
}
export declare class MergeSourceDto {
    poId: string;
    accYear: string;
}
export declare class MergePurchaseOrdersDto {
    sources: MergeSourceDto[];
    accYear: string;
    deviceId: string;
    docDate?: string;
}
export declare class PendingPoLinesQueryDto {
    companyId: string;
    branchId: string;
    supplierId: string;
}
type Db = Prisma.TransactionClient | PrismaService;
export declare function poLineStatus(qty: Prisma.Decimal, received: Prisma.Decimal, shortClosed: Prisma.Decimal): "OPEN" | "DONE" | "SHORT_CLOSED" | "PART";
export declare function poDocStatus(status: string, approval: string, lineStatuses: string[]): "CLOSED" | "DRAFT" | "CANCELLED" | "CONFIRMED" | "RECEIVED" | "AWAITING_APPROVAL" | "NOT_APPROVED" | "PART_RECEIVED";
export declare function poApprovalStatus(a: {
    limit: Prisma.Decimal;
    goods: {
        taxable: Prisma.Decimal;
        cgst: Prisma.Decimal;
        sgst: Prisma.Decimal;
        igst: Prisma.Decimal;
        cess: Prisma.Decimal;
    };
    chargesEstimate: Prisma.Decimal;
    confirming: boolean;
    amending: boolean;
    current: string | null;
    currentGoodsValue: Prisma.Decimal | null;
}): {
    status: string;
    value: Prisma.Decimal;
};
export declare function poUsedQty(tx: Db, poId: string): Promise<Map<string, Prisma.Decimal>>;
export declare function assertPoApproved(tx: Db, poId: string): Promise<void>;
export declare function closePosOnFirstBill(tx: Prisma.TransactionClient, a: {
    piId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    refno: string;
    actor: string;
}): Promise<{
    code: string;
    message: string;
    field: string;
}[]>;
export declare class PurchaseOrderService {
    private readonly prisma;
    private readonly ctx;
    private readonly audit;
    constructor(prisma: PrismaService, ctx: RequestContextService, audit: AuditLogService);
    private actor;
    private compute;
    private agentOf;
    private estimateCharges;
    preview(dto: SavePurchaseOrderDto): Promise<{
        header: {
            agentId: string | null;
            agentName: string | null;
        };
        lines: {
            key: string;
            gross: Prisma.Decimal;
            discAmt: Prisma.Decimal;
            taxable: Prisma.Decimal;
            gstPct: Prisma.Decimal;
            tax: Prisma.Decimal;
            total: Prisma.Decimal;
        }[];
        charges: {
            rate: string;
            amount: string;
            signedAmount: string;
            chgId: string;
            chgName: string;
            role: string | null;
            type: string;
            method: string;
            onBill: boolean;
            ledgerId: string;
            costAlloc: string | null;
            beforeTax: boolean;
            landingCost: boolean;
        }[];
        totals: {
            gross: Prisma.Decimal;
            taxable: Prisma.Decimal;
            tax: Prisma.Decimal;
            net: Prisma.Decimal;
            lines: number;
            orderedValue: string;
            chargesEstimate: string;
            poTotal: string;
        };
    }>;
    save(dto: SavePurchaseOrderDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    saveIn(tx: Prisma.TransactionClient, dto: SavePurchaseOrderDto, actor: string, opts?: {
        auditNote?: string;
    }): Promise<string>;
    get(poId: string, accYear: string): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    private lineContext;
    private getDoc;
    cancel(dto: PurchaseOrderReasonDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    shortClose(dto: PurchaseOrderReasonDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    approve(dto: PurchaseOrderApproveDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    clone(dto: ClonePurchaseOrderDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    merge(dto: MergePurchaseOrdersDto): Promise<{
        lines: {
            [x: string]: unknown;
        }[];
        header: Record<string, unknown>;
    }>;
    revisions(poId: string): Promise<Record<string, unknown>[]>;
    pendingLines(q: PendingPoLinesQueryDto): Promise<Record<string, unknown>[]>;
}
export declare class PurchaseOrderController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseOrderService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    save(dto: SavePurchaseOrderDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    validate(dto: SavePurchaseOrderDto): Promise<{
        success: boolean;
        message: string;
        data: {
            header: {
                agentId: string | null;
                agentName: string | null;
            };
            lines: {
                key: string;
                gross: Prisma.Decimal;
                discAmt: Prisma.Decimal;
                taxable: Prisma.Decimal;
                gstPct: Prisma.Decimal;
                tax: Prisma.Decimal;
                total: Prisma.Decimal;
            }[];
            charges: {
                rate: string;
                amount: string;
                signedAmount: string;
                chgId: string;
                chgName: string;
                role: string | null;
                type: string;
                method: string;
                onBill: boolean;
                ledgerId: string;
                costAlloc: string | null;
                beforeTax: boolean;
                landingCost: boolean;
            }[];
            totals: {
                gross: Prisma.Decimal;
                taxable: Prisma.Decimal;
                tax: Prisma.Decimal;
                net: Prisma.Decimal;
                lines: number;
                orderedValue: string;
                chargesEstimate: string;
                poTotal: string;
            };
        };
    }>;
    get(q: PurchaseOrderRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    pending(q: PendingPoLinesQueryDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>[];
    }>;
    cancel(dto: PurchaseOrderReasonDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    shortClose(dto: PurchaseOrderReasonDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    approve(dto: PurchaseOrderApproveDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    clone(dto: ClonePurchaseOrderDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    merge(dto: MergePurchaseOrdersDto): Promise<{
        success: boolean;
        message: string;
        data: {
            lines: {
                [x: string]: unknown;
            }[];
            header: Record<string, unknown>;
        };
    }>;
    revisions(q: PurchaseOrderRefDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>[];
    }>;
}
export {};
