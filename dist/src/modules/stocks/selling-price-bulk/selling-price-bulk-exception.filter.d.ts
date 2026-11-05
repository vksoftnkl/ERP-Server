import { ArgumentsHost } from '@nestjs/common';
import { StockExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { StockErrorDetail, StockErrorResponse } from './types/selling-price-bulk.types';
export declare class SellingPriceBulkExceptionFilter extends StockExceptionFilter<StockErrorDetail, StockErrorResponse> {
    constructor();
    catch(exception: unknown, host: ArgumentsHost): void;
    private translateEngineError;
    private readMeta;
}
