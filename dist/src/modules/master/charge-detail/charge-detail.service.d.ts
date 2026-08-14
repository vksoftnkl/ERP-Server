import { TransactionChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { GetChargeDetailQueryDto } from './dto/get-charge-detail-query.dto';
import { SaveChargeDetailDto } from './dto/save-charge-detail.dto';
import { ChargeDetailDeleteResult, ChargeDetailPayload, ChargeDocType, ChargeDocumentAudit, ChargeDocumentScope } from './types/charge-detail-api.types';
import { MasterWriteClient } from "../../../common/utils/module-service.utils";
type ChargeDetailWriteClient = MasterWriteClient;
type ChargeDetailRecord = TransactionChargeDetail & {
    ledger?: {
        ledName: string;
    } | null;
};
export declare class ChargeDetailService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveChargeDetailDto: SaveChargeDetailDto): Promise<ChargeDetailPayload>;
    get(getChargeDetailQueryDto: GetChargeDetailQueryDto): Promise<ChargeDetailPayload | ChargeDetailPayload[]>;
    getById(cdId: string): Promise<ChargeDetailPayload>;
    getByDocument(cdDocType: ChargeDocType, cdDocId: string, isActive?: boolean): Promise<ChargeDetailPayload[]>;
    softDelete(cdId: string): Promise<ChargeDetailDeleteResult>;
    syncDocumentCharges(tx: ChargeDetailWriteClient, scope: ChargeDocumentScope, inputCharges: SaveChargeDetailDto[] | undefined, actorId: string, audit?: ChargeDocumentAudit): Promise<ChargeDetailPayload[]>;
    findDocumentCharges(client: ChargeDetailWriteClient, cdDocType: ChargeDocType, cdDocId: string): Promise<ChargeDetailRecord[]>;
    softDeleteDocumentCharges(tx: ChargeDetailWriteClient, cdDocType: ChargeDocType, cdDocId: string, actorId: string, modifiedOn?: Date): Promise<void>;
    private createChargeDetail;
    private updateChargeDetail;
    private insertChargeLine;
    private updateChargeLine;
    private softDeleteChargeLine;
    private ensureDocumentIsUnchanged;
    private ensureDocumentMatchesScope;
    private ensureLedgerExists;
    private ensureChargeExists;
    private resolveSlno;
    private ensureValuesAreAllowed;
    private requireField;
    private toVoucherNo;
    private handleWriteError;
    private throwNotFound;
    private displayName;
    toPayload(record: ChargeDetailRecord, ledgerName?: string | null): ChargeDetailPayload;
}
export {};
