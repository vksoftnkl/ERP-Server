import { PrismaService } from "../../database/prisma/prisma.service";
import { ItemPriceDetailPayloadDto } from "../Inventory/item-price-details/dto/item-price-detail-response.dto";
export declare class ItemPriceDetailsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getByItemId(itemId: string): Promise<ItemPriceDetailPayloadDto>;
    private toItemUnitConversionPayload;
    private toItemPayload;
    private toItemPricePayload;
    private toItemTaxPayload;
    private toNumber;
    private throwItemNotFound;
    private buildErrorResponse;
}
