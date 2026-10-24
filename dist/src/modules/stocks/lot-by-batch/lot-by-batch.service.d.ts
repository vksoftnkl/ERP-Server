import { PrismaService } from "../../../database/prisma/prisma.service";
import type { LotByBatchQueryDto } from './dto/lot-by-batch-query.dto';
export interface LotByBatchGodown {
    godownId: string;
    godownName: string | null;
    bucket: string;
    onHandQty: number;
    availableQty: number;
    avgCostRate: number;
}
export interface LotByBatchRow {
    lotId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string | null;
    baseUomId: string;
    baseUnitName: string | null;
    batchNo: string;
    mrp: number | null;
    salePrice: number | null;
    status: string;
    sizeId: string | null;
    sizeName: string | null;
    colourId: string | null;
    colourName: string | null;
    model: string | null;
    onHandQty: number;
    avgCostRate: number;
    godowns: LotByBatchGodown[];
}
export declare class LotByBatchService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    find(q: LotByBatchQueryDto): Promise<LotByBatchRow[]>;
}
