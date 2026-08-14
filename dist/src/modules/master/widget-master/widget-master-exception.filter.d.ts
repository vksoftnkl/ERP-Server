import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class WidgetMasterExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isWidgetMasterErrorResponse;
    private isValidationExceptionPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
