import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VoucherPostingService } from "../../../common/posting/voucher-posting.service";
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { TillEventService } from '../../till/services/till-event.service';
import type { ConfirmSettlementLineDto, IgnoreSettlementLineDto, ImportSettlementDto, SaveSettlementFormatDto, SettlementKeyDto, SettlementLineKeyDto, VoidSettlementDto } from './dto/tender-settlement.dto';
import { type TenderSettings } from './tender-settlement.settings';
import type { SettlementFormatPayload, SettlementFormatTestPayload, SettlementImportPayload, SettlementImportResultPayload, SettlementLegPayload, SettlementLinePayload, SettlementPostPayload } from './types/tender-settlement-api.types';
import { SettlementLineKind } from './types/tender-settlement-enum';
type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;
type ImportRow = Prisma.AccSettlementImportGetPayload<object>;
type LineRow = Prisma.AccSettlementLineGetPayload<object>;
export interface UploadedStatement {
    buffer: Buffer;
    originalname?: string;
}
export interface SettlementCaller {
    userId: string;
    actorName: string;
}
export declare class TenderSettlementService {
    private readonly prisma;
    private readonly requestContext;
    private readonly posting;
    private readonly appSettings;
    private readonly events;
    constructor(prisma: PrismaService, requestContext: RequestContextService, posting: VoucherPostingService, appSettings: AppSettingValueService, events: TillEventService);
    getFormat(companyId: string, tenderId: string): Promise<SettlementFormatPayload>;
    saveFormat(dto: SaveSettlementFormatDto): Promise<SettlementFormatPayload>;
    testFormat(companyId: string, tenderId: string, file: UploadedStatement | undefined): Promise<SettlementFormatTestPayload>;
    import(dto: ImportSettlementDto, file: UploadedStatement | undefined): Promise<SettlementImportResultPayload>;
    match(key: SettlementKeyDto): Promise<SettlementImportPayload>;
    confirm(dto: ConfirmSettlementLineDto): Promise<SettlementImportPayload>;
    unlink(dto: SettlementLineKeyDto): Promise<SettlementImportPayload>;
    ignore(dto: IgnoreSettlementLineDto): Promise<SettlementImportPayload>;
    post(key: SettlementKeyDto): Promise<SettlementPostPayload>;
    void(dto: VoidSettlementDto): Promise<SettlementImportPayload>;
    get(key: SettlementKeyDto): Promise<SettlementImportPayload>;
    linePayloadOf(tx: Client, line: LineRow): Promise<SettlementLinePayload>;
    legsOf(voucherId: string | null, accYear: string | null): Promise<SettlementLegPayload[]>;
    caller(client?: Client): Promise<SettlementCaller>;
    settings(companyId: string, branchId: string): Promise<TenderSettings>;
    roleLedger(tx: Client, role: string, scope: {
        asiCompanyId: string;
        asiBranchId: string;
    }): Promise<string>;
    voucherTypeId(tx: Client, code: string): Promise<number>;
    loadImport(client: Client, key: SettlementKeyDto): Promise<ImportRow>;
    lockLine(tx: Tx, key: SettlementLineKeyDto): Promise<{
        head: ImportRow;
        line: LineRow;
    }>;
    candidateRow(tx: Client, head: ImportRow, line: LineRow, tdId: string, tdAccYear: string): Promise<SettlementRow>;
    assertTdFree(tx: Client, line: LineRow, tdId: string, tdAccYear: string): Promise<void>;
    parkedRows(tx: Client, tdIds: string[]): Promise<Set<string>>;
    rowsOf(tx: Client, keys: {
        tdId: string;
        tdAccYear: string;
    }[]): Promise<Map<string, SettlementRow>>;
    refreshImport(tx: Tx, head: ImportRow): Promise<void>;
    private runMatch;
    private lineTenders;
    private loadTender;
    private requireFormat;
    private formatPayload;
    private fileText;
    private assertSettlementPartition;
    private lockImport;
    private assertOpen;
    private unmatchedData;
    private keyOf;
    private tenderRowPayloads;
    private importPayload;
    private linePayload;
}
export interface SettlementRow {
    tdId: string;
    tdAccYear: string;
    companyId: string;
    branchId: string;
    tenderId: string;
    tenderTypeId: number;
    drCr: 'DR' | 'CR';
    settleStatus: string;
    amount: Prisma.Decimal;
    settleAmount: Prisma.Decimal | null;
    ledgerId: string;
    sessionId: string | null;
    srcDocType: string;
    srcDocId: string;
    settleVoucherId: string | null;
    isVoided: boolean;
    isDeleted: boolean;
}
export declare function signedTotals(lines: readonly {
    kind: SettlementLineKind;
    gross: Prisma.Decimal;
    fee: Prisma.Decimal;
    tax: Prisma.Decimal;
}[]): {
    gross: Prisma.Decimal;
    fee: Prisma.Decimal;
    tax: Prisma.Decimal;
    net: Prisma.Decimal;
};
export declare class LegBook {
    private readonly byLedger;
    add(ledgerId: string, side: 'DR' | 'CR', amount: Prisma.Decimal, role: string | null): void;
    legs(): {
        ledgerId: string;
        drCr: 'DR' | 'CR';
        amount: Prisma.Decimal;
        role: string | null;
    }[];
}
export {};
