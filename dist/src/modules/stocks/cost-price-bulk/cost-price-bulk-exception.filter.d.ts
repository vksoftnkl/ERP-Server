import { ArgumentsHost, HttpException } from '@nestjs/common';
import { SellingPriceBulkExceptionFilter } from '../selling-price-bulk/selling-price-bulk-exception.filter';
export declare const VALUE_TOO_LARGE = "VALUE_TOO_LARGE";
export declare class CostPriceBulkExceptionFilter extends SellingPriceBulkExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
}
export declare function overflowRefusal(exception: unknown): HttpException | null;
