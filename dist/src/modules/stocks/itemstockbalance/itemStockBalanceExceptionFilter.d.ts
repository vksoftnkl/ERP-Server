import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class ItemStockBalanceExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isItemStockBalanceErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
