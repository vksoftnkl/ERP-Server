import { PrismaService } from "../../../database/prisma/prisma.service";
import { ItemPriceDetailPayload } from './types/item-price-detail-api.types';
import { ItemUnitConversionService } from '../item-unit-conversion/item-unit-conversion.service';
export declare class ItemPriceDetailsService {
    private readonly prisma;
    private readonly itemUnitConversionService;
    constructor(prisma: PrismaService, itemUnitConversionService: ItemUnitConversionService);
    getByBarcode(barcode: string): Promise<ItemPriceDetailPayload>;
    getByItemId(itemId: string): Promise<ItemPriceDetailPayload>;
    private toItemPayload;
    private toItemPricePayload;
    private toItemTaxPayload;
}
