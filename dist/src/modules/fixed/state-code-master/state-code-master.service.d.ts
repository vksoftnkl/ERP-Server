import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListStateCodeMasterQueryDto } from './dto/list-state-code-master-query.dto';
import { SaveStateCodeMasterDto } from './dto/save-state-code-master.dto';
import { StateCodeMasterListItem, StateCodeMasterListMeta, StateCodeMasterPayload } from './types/state-code-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class StateCodeMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveStateCodeMasterDto: SaveStateCodeMasterDto): Promise<StateCodeMasterPayload>;
    list(queryDto: ListStateCodeMasterQueryDto): Promise<ConfiguredGridListResult<StateCodeMasterListItem, StateCodeMasterListMeta>>;
    getById(stateCodeValue: string): Promise<StateCodeMasterPayload>;
    softDelete(stateCodeValue: string): Promise<{
        stateCode: string;
        deleted: true;
    }>;
    private createStateCode;
    private updateStateCode;
    private ensureStateNameIsUnique;
    private normalizeStateCode;
    private toPayload;
}
