import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class PhysicalStockExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void;
    private isPhysicalStockErrorResponse;
    private isValidationPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
