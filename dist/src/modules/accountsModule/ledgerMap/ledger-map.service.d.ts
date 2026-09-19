import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerMapDto } from './dto/save-ledger-map.dto';
import type { LedgerMapDeletePayload, LedgerMapRolePayload } from './types/ledger-map-api.types';
export declare class LedgerMapService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    listRoles(): Promise<LedgerMapRolePayload[]>;
    save(saveLedgerMapDto: SaveLedgerMapDto): Promise<LedgerMapRolePayload>;
    softDelete(almId: string): Promise<LedgerMapDeletePayload>;
    private createMapping;
    private updateMapping;
    private requireRole;
    private requireLedgerFitsRole;
    private requireShared;
    private toPayload;
    private toAuditRecord;
    private logChange;
}
