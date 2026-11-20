import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import type { MobileMe } from './types/mobile-me-api.types';
export declare const MOBILE_ME_MENUS: readonly [11, 12, 99];
export declare class MobileMeService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    me(): Promise<MobileMe>;
}
