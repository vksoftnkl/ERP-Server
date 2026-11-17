import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { CreateMobileVisitDto } from './dto/mobile-visit.dto';
import type { MobileVisitCreateResult } from './types/mobile-visit-api.types';
export declare class MobileVisitService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    create(dto: CreateMobileVisitDto): Promise<MobileVisitCreateResult>;
    private assertPositionPair;
    private assertCustomer;
    private assertSalesman;
    private findByClientUuid;
    private resendAnswer;
    private answer;
}
