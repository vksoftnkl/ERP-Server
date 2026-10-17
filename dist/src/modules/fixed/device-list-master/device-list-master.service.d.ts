import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListDeviceListMasterQueryDto } from './dto/list-device-list-master-query.dto';
import { SaveDeviceListMasterDto } from './dto/save-device-list-master.dto';
import { DeviceListMasterListItem, DeviceListMasterListMeta, DeviceListMasterPayload } from './types/device-list-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class DeviceListMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly configuredGridSqlService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, configuredGridSqlService: ConfiguredGridSqlService, requestContextService: RequestContextService);
    save(saveDeviceListMasterDto: SaveDeviceListMasterDto): Promise<DeviceListMasterPayload>;
    list(queryDto: ListDeviceListMasterQueryDto): Promise<ConfiguredGridListResult<DeviceListMasterListItem, DeviceListMasterListMeta>>;
    getById(devId: string): Promise<DeviceListMasterPayload>;
    private resolveRelatedNames;
    softDelete(devId: string): Promise<{
        devId: string;
        deleted: true;
    }>;
    private createDevice;
    private updateDevice;
    private ensureDeviceUidIsUnique;
    private toPayload;
}
