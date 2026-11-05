import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class BatchPrefixExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isBatchPrefixErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
