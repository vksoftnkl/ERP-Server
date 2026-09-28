import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { StockAccountsPostingService } from '../posting/stock-accounts-posting.service';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherPayload, StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import type { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import type { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import type { StockTransferDespatchResult, StockTransferPrefill, StockTransferReceiveResult, StockTransferSettleShortResult, StockTransitRow } from './types/stock-transfer.types';
export declare class StockTransferService {
    private readonly prisma;
    private readonly stockVoucherService;
    private readonly requestContextService;
    private readonly stockAccounts;
    constructor(prisma: PrismaService, stockVoucherService: StockVoucherService, requestContextService: RequestContextService, stockAccounts: StockAccountsPostingService);
    save(rules: StockVoucherTypeRules, dto: SaveStockTransferDto): Promise<StockVoucherPayload>;
    private assertTransferOutRules;
    private assertLotsAndStock;
    despatch(rules: StockVoucherTypeRules, args: {
        svhId: string;
        accYear: string;
        companyId: string;
        branchId: string;
        userId?: string;
        lrNo?: string | null;
        vehicleNo?: string | null;
        expectedOn?: string | null;
    }): Promise<StockTransferDespatchResult>;
    getOne(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string): Promise<StockVoucherPayload & {
        transit: StockTransitRow[];
    }>;
    inbound(companyId: string, branchId: string, limit?: number, offset?: number): Promise<{
        items: Array<StockTransitRow & {
            outRefno: string | null;
            fromBranchId: string;
            daysInFlight: number;
        }>;
        meta: {
            limit: number;
            offset: number;
            count: number;
        };
    }>;
    prefill(companyId: string, branchId: string, outVoucherId: string, accYear: string): Promise<StockTransferPrefill>;
    private assertReceivable;
    saveReceive(rules: StockVoucherTypeRules, dto: SaveStockTransferReceiveDto): Promise<StockVoucherPayload>;
    private assertReceiveLines;
    private lineQty;
    receive(rules: StockVoucherTypeRules, svhId: string, accYear: string, companyId: string, branchId: string, userId?: string): Promise<StockTransferReceiveResult>;
    settleShort(args: {
        outVoucherId: string;
        accYear: string;
        companyId: string;
        branchId: string;
        reasonId: string;
        remarks?: string | null;
        userId?: string;
    }): Promise<StockTransferSettleShortResult>;
    private loadTransitRows;
    private toTransitRow;
    private toIsoDate;
    private holdingKey;
}
