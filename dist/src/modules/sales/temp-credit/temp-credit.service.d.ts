import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type { OpenTempCreditsQueryDto, TempCreditFollowUpDto } from './dto/temp-credit.dto';
export declare class TempCreditService {
    private readonly prisma;
    private readonly requestContext;
    private readonly audit;
    constructor(prisma: PrismaService, requestContext: RequestContextService, audit: AuditLogService);
    open(q: OpenTempCreditsQueryDto): Promise<Record<string, unknown>[]>;
    followUp(dto: TempCreditFollowUpDto): Promise<Record<string, unknown>>;
}
