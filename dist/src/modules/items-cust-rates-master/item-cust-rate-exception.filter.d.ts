import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class ItemCustRateExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isItemCustRateErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
