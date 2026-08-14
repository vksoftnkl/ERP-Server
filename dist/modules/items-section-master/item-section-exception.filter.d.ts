import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class ItemSectionExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isItemSectionErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
