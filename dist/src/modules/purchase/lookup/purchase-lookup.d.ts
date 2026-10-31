import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { PurchaseOrderService } from '../order/purchase-order';
export declare class SupplierContextQueryDto {
    companyId: string;
    branchId: string;
    supplierId: string;
    onDate?: string;
}
export declare class ItemContextQueryDto {
    companyId: string;
    branchId: string;
    itemId: string;
    supplierId?: string;
    uomId?: string;
    onDate?: string;
}
export declare function msmeDueDays(category: string | null, activity: string | null, agreement: boolean | null, agreedDays: number | null): number | null;
export declare class PurchaseLookupService {
    private readonly prisma;
    private readonly orders;
    constructor(prisma: PrismaService, orders: PurchaseOrderService);
    supplierContext(q: SupplierContextQueryDto): Promise<{
        supplierId: unknown;
        name: unknown;
        gstNo: {} | null;
        gstType: {} | null;
        stateCode: {} | null;
        stateName: {} | null;
        creditDays: number | null;
        cashDiscPct: {} | null;
        notes: string | null;
        showNotesOnEntry: unknown;
        isImport: unknown;
        defaultGodownId: {} | null;
        defaultGodownName: {} | null;
        msme: {
            category: string;
            activity: string | null;
            udyamNo: {} | null;
            writtenAgreement: boolean;
            agreedDays: {} | null;
            dueDays: number | null;
            payBy: string | null;
        } | null;
        licences: {
            drugLicenceNo: {} | null;
            drugLicenceExpiry: string | null;
            fssaiNo: {} | null;
            fssaiValidTo: string | null;
        };
        billFrom: {
            addrId: string | null;
            gstin: string;
            stateCode: string | null;
            stateName: string | null;
            name: string | null;
            addr: string | null;
            place: string | null;
            pin: string | null;
            isDefault: boolean;
            source: "MASTER" | "LEDGER_ADDRESS";
        }[];
        pendingPos: {
            poId: string;
            accYear: string;
            refno: string;
            docDate: string | null;
            lines: number;
        }[];
        outstanding: {
            payable: Prisma.Decimal;
            debits: Prisma.Decimal;
            balance: Prisma.Decimal;
            bills: number;
            overdueBills: number;
            oldestDue: string | null;
            billsOnHold: number;
        };
        warnings: {
            code: string;
            message: string;
        }[];
    }>;
    itemContext(q: ItemContextQueryDto): Promise<{
        itemId: string;
        itemName: string;
        baseUnit: string | null;
        lastPurchases: {
            docDate: string | null;
        }[];
        poRate: Record<string, unknown> | null;
        stock: {
            saleable: Prisma.Decimal;
            damaged: Prisma.Decimal;
            unitName: string | null;
        };
        prices: {
            effectiveFrom: string | null;
        } | null;
        supplierItem: Record<string, unknown> | null;
    }>;
}
export declare class PurchaseLookupController {
    private readonly service;
    constructor(service: PurchaseLookupService);
    supplierContext(q: SupplierContextQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            supplierId: unknown;
            name: unknown;
            gstNo: {} | null;
            gstType: {} | null;
            stateCode: {} | null;
            stateName: {} | null;
            creditDays: number | null;
            cashDiscPct: {} | null;
            notes: string | null;
            showNotesOnEntry: unknown;
            isImport: unknown;
            defaultGodownId: {} | null;
            defaultGodownName: {} | null;
            msme: {
                category: string;
                activity: string | null;
                udyamNo: {} | null;
                writtenAgreement: boolean;
                agreedDays: {} | null;
                dueDays: number | null;
                payBy: string | null;
            } | null;
            licences: {
                drugLicenceNo: {} | null;
                drugLicenceExpiry: string | null;
                fssaiNo: {} | null;
                fssaiValidTo: string | null;
            };
            billFrom: {
                addrId: string | null;
                gstin: string;
                stateCode: string | null;
                stateName: string | null;
                name: string | null;
                addr: string | null;
                place: string | null;
                pin: string | null;
                isDefault: boolean;
                source: "MASTER" | "LEDGER_ADDRESS";
            }[];
            pendingPos: {
                poId: string;
                accYear: string;
                refno: string;
                docDate: string | null;
                lines: number;
            }[];
            outstanding: {
                payable: Prisma.Decimal;
                debits: Prisma.Decimal;
                balance: Prisma.Decimal;
                bills: number;
                overdueBills: number;
                oldestDue: string | null;
                billsOnHold: number;
            };
            warnings: {
                code: string;
                message: string;
            }[];
        };
    }>;
    itemContext(q: ItemContextQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            itemId: string;
            itemName: string;
            baseUnit: string | null;
            lastPurchases: {
                docDate: string | null;
            }[];
            poRate: Record<string, unknown> | null;
            stock: {
                saleable: Prisma.Decimal;
                damaged: Prisma.Decimal;
                unitName: string | null;
            };
            prices: {
                effectiveFrom: string | null;
            } | null;
            supplierItem: Record<string, unknown> | null;
        };
    }>;
}
