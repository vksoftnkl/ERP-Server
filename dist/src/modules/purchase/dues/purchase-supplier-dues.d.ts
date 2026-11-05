import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { PurchaseReturnService } from '../return/purchase-return';
import { PurchaseShortageService } from '../shortage/purchase-shortage';
export declare const SUPPLIER_DUES_MENU_ID = 297;
export declare class SupplierDuesQueryDto {
    companyId: string;
    branchId: string;
    supplierId?: string;
    all?: string;
}
export declare class DuesSettleRowDto {
    returnItemId?: string;
    shortageCloseId?: string;
    accYear: string;
    amount?: number;
}
export declare class DuesSettleDto {
    rows: DuesSettleRowDto[];
    deviceId: string;
    action: string;
    receivedAs?: string;
    cnNo?: string;
    cnDate?: string;
    docDate?: string;
    settleAccYear?: string;
    writeOffRest?: boolean;
    writeOffReason?: string;
    reason?: string;
    dryRun?: boolean;
}
export declare class DuesSettleUndoDto {
    settlementId: string;
    accYear: string;
    reason: string;
}
export declare class PurchaseSupplierDuesService {
    private readonly prisma;
    private readonly ctx;
    private readonly returns;
    private readonly shortages;
    constructor(prisma: PrismaService, ctx: RequestContextService, returns: PurchaseReturnService, shortages: PurchaseShortageService);
    open(q: SupplierDuesQueryDto, sections: {
        claims: boolean;
        shortages: boolean;
    }): Promise<{
        claims: Record<string, unknown>[];
        shortages: Record<string, unknown>[];
        totals: {
            openCount: number;
            claims: {
                rows: number;
                value: string;
                credited: string;
                writtenOff: string;
                open: string;
            };
            shortages: {
                rows: number;
                openQtyBase: string;
                openValue: string;
                gstHeld: string;
            };
        };
        sections: {
            claims: boolean;
            shortages: boolean;
        };
        cashNote: string;
    }>;
    settle(dto: DuesSettleDto): Promise<{
        dryRun: boolean;
        steps: {
            source: string;
            returnItemId: string | null;
            shortageCloseId: string | null;
            refno: string;
            lineNo: number | null;
            action: string;
            receivedAs: string | null;
            amount: string;
            gstReavailed: string;
            openAfter: string;
            settlementId: string | null;
            accYear: string;
            voucherRefno: string | null;
            legs: {
                drCr: "DR" | "CR";
                role: string | null;
                ledgerId: string | null;
                ledgerName: string | null;
                amount: string;
                remarks: string | null;
            }[];
        }[];
        totals: {
            credited: string;
            writtenOff: string;
            gstReavailed: string;
        };
        cashNote: string;
    }>;
    settleUndo(dto: DuesSettleUndoDto): Promise<{
        reversalId: string;
        shortageCloseId: string;
        source: string;
        returnItemId: null;
    } | {
        reversalId: string;
        returnItemId: string;
        source: string;
        shortageCloseId: null;
    }>;
    settlementKind(settlementId: string, accYear: string): Promise<'RETURN' | 'SHORTAGE'>;
    private legNames;
}
export declare class PurchaseSupplierDuesController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseSupplierDuesService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    open(q: SupplierDuesQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            claims: Record<string, unknown>[];
            shortages: Record<string, unknown>[];
            totals: {
                openCount: number;
                claims: {
                    rows: number;
                    value: string;
                    credited: string;
                    writtenOff: string;
                    open: string;
                };
                shortages: {
                    rows: number;
                    openQtyBase: string;
                    openValue: string;
                    gstHeld: string;
                };
            };
            sections: {
                claims: boolean;
                shortages: boolean;
            };
            cashNote: string;
        };
    }>;
    settle(dto: DuesSettleDto): Promise<{
        success: boolean;
        message: string;
        data: {
            dryRun: boolean;
            steps: {
                source: string;
                returnItemId: string | null;
                shortageCloseId: string | null;
                refno: string;
                lineNo: number | null;
                action: string;
                receivedAs: string | null;
                amount: string;
                gstReavailed: string;
                openAfter: string;
                settlementId: string | null;
                accYear: string;
                voucherRefno: string | null;
                legs: {
                    drCr: "DR" | "CR";
                    role: string | null;
                    ledgerId: string | null;
                    ledgerName: string | null;
                    amount: string;
                    remarks: string | null;
                }[];
            }[];
            totals: {
                credited: string;
                writtenOff: string;
                gstReavailed: string;
            };
            cashNote: string;
        };
    }>;
    settleUndo(dto: DuesSettleUndoDto): Promise<{
        success: boolean;
        message: string;
        data: {
            reversalId: string;
            shortageCloseId: string;
            source: string;
            returnItemId: null;
        } | {
            reversalId: string;
            returnItemId: string;
            source: string;
            shortageCloseId: null;
        };
    }>;
}
