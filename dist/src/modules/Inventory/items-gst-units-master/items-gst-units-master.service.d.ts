import { PrismaService } from "../../../database/prisma/prisma.service";
import { GetItemGstUnitQueryDto } from './dto/get-item-gst-unit-query.dto';
import { ItemGstUnitPayload } from './types/item-gst-unit-api.types';
export declare class ItemsGstUnitsMasterService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(queryDto: GetItemGstUnitQueryDto): Promise<ItemGstUnitPayload[]>;
    private toPayload;
}
