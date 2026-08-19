import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class ItemBatchStockExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isItemBatchStockErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
