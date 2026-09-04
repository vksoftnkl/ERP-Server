import { ArgumentMetadata, Type } from '@nestjs/common';
type ValidateDtoOptions = {
    optional?: boolean;
    type?: ArgumentMetadata['type'];
};
type OptionalValidateDtoOptions = ValidateDtoOptions & {
    optional: true;
};
type RequiredValidateDtoOptions = ValidateDtoOptions & {
    optional?: false;
};
export declare const hasRequestPayload: (value: unknown) => boolean;
export declare function validateDto<T extends object>(value: unknown, metatype: Type<T>, options: OptionalValidateDtoOptions): Promise<T | undefined>;
export declare function validateDto<T extends object>(value: unknown, metatype: Type<T>, options?: RequiredValidateDtoOptions): Promise<T>;
export declare function validateDto<T extends object>(value: unknown, metatype: Type<T>, options: ValidateDtoOptions): Promise<T | undefined>;
export declare function validateSingleOrArrayDto<T extends object>(value: unknown, metatype: Type<T>, options: OptionalValidateDtoOptions): Promise<T | T[] | undefined>;
export declare function validateSingleOrArrayDto<T extends object>(value: unknown, metatype: Type<T>, options?: RequiredValidateDtoOptions): Promise<T | T[]>;
export declare function validateSingleOrArrayDto<T extends object>(value: unknown, metatype: Type<T>, options: ValidateDtoOptions): Promise<T | T[] | undefined>;
export {};
