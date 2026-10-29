import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { ItemAttributeMasterService } from './item-attribute-master.service';
export declare class ItemColourMasterService extends ItemAttributeMasterService {
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
}
