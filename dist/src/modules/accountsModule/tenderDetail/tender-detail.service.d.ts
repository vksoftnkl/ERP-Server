import { AccTenderDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { GetTenderDetailQueryDto } from './dto/get-tender-detail-query.dto';
import { SaveTenderDetailDto } from './dto/save-tender-detail.dto';
import { TenderDetailDeleteResult, TenderDetailPayload, TenderDocumentAudit, TenderDocumentScope, TenderSrcDocType, TenderSrcModule } from './types/tender-detail-api.types';
import { AccountsWriteClient } from "../../../common/utils/module-service.utils";
type TenderDetailWriteClient = AccountsWriteClient;
type TenderDetailRecord = AccTenderDetail & {
    tender?: {
        tndName: string;
    } | null;
    ledger?: {
        ledName: string;
    } | null;
};
export declare class TenderDetailService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveTenderDetailDto: SaveTenderDetailDto): Promise<TenderDetailPayload>;
    get(getTenderDetailQueryDto: GetTenderDetailQueryDto): Promise<TenderDetailPayload | TenderDetailPayload[]>;
    getById(tdId: string): Promise<TenderDetailPayload>;
    getByDocument(tdSrcModule: TenderSrcModule, tdSrcDocType: TenderSrcDocType, tdSrcDocId: string): Promise<TenderDetailPayload[]>;
    softDelete(tdId: string): Promise<TenderDetailDeleteResult>;
    syncDocumentTenders(tx: TenderDetailWriteClient, scope: TenderDocumentScope, inputTenders: SaveTenderDetailDto[] | undefined, actorId: string, audit?: TenderDocumentAudit): Promise<TenderDetailPayload[]>;
    findDocumentTenders(client: TenderDetailWriteClient, tdSrcModule: TenderSrcModule, tdSrcDocType: TenderSrcDocType, tdSrcDocId: string): Promise<TenderDetailRecord[]>;
    softDeleteDocumentTenders(tx: TenderDetailWriteClient, tdSrcModule: TenderSrcModule, tdSrcDocType: TenderSrcDocType, tdSrcDocId: string, actorId: string, modifiedOn?: Date): Promise<void>;
    private createTenderDetail;
    private updateTenderDetail;
    private insertTenderLine;
    private updateTenderLine;
    private softDeleteTenderLine;
    private ensureDocumentIsUnchanged;
    private ensureDocumentMatchesScope;
    private ensureTenderExists;
    private ensureTenderTypeExists;
    private ensureLedgerExists;
    private resolveRowNo;
    private resolveTotalAmt;
    private ensureValuesAreAllowed;
    private mergedDecimal;
    private toDecimal;
    private toTenderTypeId;
    private requireField;
    private displayJoins;
    private handleWriteError;
    private throwNotFound;
    private displayName;
    private toOutputDateOnly;
    toPayload(record: TenderDetailRecord, tenderName?: string | null, tenderLedgerName?: string | null): TenderDetailPayload;
}
export {};
