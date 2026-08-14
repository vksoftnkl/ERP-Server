import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class OpeningStockExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isOpeningStockErrorResponse;
    private isValidationPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
