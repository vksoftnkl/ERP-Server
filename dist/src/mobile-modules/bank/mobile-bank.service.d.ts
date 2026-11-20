import { PrismaService } from '../../database/prisma/prisma.service';
import type { MobileBankListQueryDto } from './dto/mobile-bank.dto';
import type { MobileBankList } from './types/mobile-bank-api.types';
export declare class MobileBankService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: MobileBankListQueryDto): Promise<MobileBankList>;
}
