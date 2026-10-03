import { ArgumentsHost } from '@nestjs/common';
import { StockExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { StockErrorDetail, StockErrorResponse } from './types/stock-voucher.types';
export declare class StockVoucherExceptionFilter extends StockExceptionFilter<StockErrorDetail, StockErrorResponse> {
    constructor();
    catch(exception: unknown, host: ArgumentsHost): void;
    private translateEngineError;
    private resolveStatus;
    private readMeta;
}
