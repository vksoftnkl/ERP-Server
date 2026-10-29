import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { StockErrorDetail } from '../stock-voucher/types/stock-voucher.types';
import type { AgeingSlabDto, SaveAgeingSlabsDto } from './dto/ageing-slabs.dto';
export declare const AGEING_SLAB_MAX = 20;
export interface AgeingSlab {
    slabNo: number;
    label: string;
    fromDays: number;
    toDays: number | null;
}
export interface AgeingSlabLadder {
    usingOwn: boolean;
    slabs: AgeingSlab[];
}
export declare function ladderErrors(slabs: readonly AgeingSlabDto[]): StockErrorDetail[];
export declare class AgeingSlabsService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    get(companyId: string): Promise<AgeingSlabLadder>;
    save(dto: SaveAgeingSlabsDto): Promise<AgeingSlabLadder>;
    revert(companyId: string): Promise<AgeingSlabLadder>;
    private author;
}
