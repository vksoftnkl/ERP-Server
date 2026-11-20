import { PrismaService } from '../../database/prisma/prisma.service';
import { MobileReturnStatusQueryDto } from './dto/mobile-return.dto';
import type { MobileReturnStatusPayload } from './types/mobile-return-api.types';
export declare const MOBILE_RETURN_STATUS_OVERLAP_MINUTES = 5;
export declare class MobileReturnStatusService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    status(query: MobileReturnStatusQueryDto): Promise<MobileReturnStatusPayload>;
    private rowsOf;
}
