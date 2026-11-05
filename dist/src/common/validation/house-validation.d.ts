import { BadRequestException, ValidationPipe, type ValidationError, type ValidationPipeOptions } from '@nestjs/common';
export interface ValidationErrorDetail {
    field: string;
    code: string;
    message: string;
}
export declare const HOUSE_VALIDATION_OPTIONS: ValidationPipeOptions;
export declare function validationCode(constraint: string): string;
export declare function validationErrorDetails(errors: readonly ValidationError[], parent?: string): ValidationErrorDetail[];
export declare function frameworkValidationCode(message: string): string;
export declare function houseValidationException(errors: ValidationError[]): BadRequestException;
export declare function createHouseValidationPipe(overrides?: Partial<ValidationPipeOptions>): ValidationPipe;
