import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class ItemBrandExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isItemBrandErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
