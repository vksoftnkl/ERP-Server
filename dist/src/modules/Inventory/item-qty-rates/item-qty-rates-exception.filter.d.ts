import { ArgumentsHost } from '@nestjs/common';
import { SellingPriceBulkExceptionFilter } from '../../stocks/selling-price-bulk/selling-price-bulk-exception.filter';
export declare const QTY_RATES_FIELD_PATTERN: RegExp;
export declare function qtyRatesFieldOf(message: string): string;
export declare class ItemQtyRatesExceptionFilter extends SellingPriceBulkExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private houseValidation;
}
