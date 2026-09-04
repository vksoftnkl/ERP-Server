import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveStateDto } from './dto/save-state.dto';
import { StateMasterCreateResult, StatePayload } from './types/state-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class StateService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveStateDto: SaveStateDto): Promise<StatePayload>;
    createStateMaster(dto: SaveStateDto, userId: string, parentId?: string): Promise<StateMasterCreateResult>;
    getById(stmId: string): Promise<StatePayload>;
    softDelete(stmId: string): Promise<{
        stmId: string;
        deleted: true;
    }>;
    private updateState;
}
