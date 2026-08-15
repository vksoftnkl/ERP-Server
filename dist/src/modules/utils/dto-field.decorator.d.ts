type EnumLike = Record<string, string | number>;
export declare function OptionalUuidField(options?: {
    description?: string;
    example?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function RequiredUuidField(options?: {
    description?: string;
    example?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalStringField(options?: {
    maxLength?: number;
    example?: string;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function RequiredStringField(options?: {
    maxLength?: number;
    example?: string;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalDateField(options?: {
    format?: 'date' | 'date-time';
    example?: string;
    default?: string;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalBooleanField(options?: {
    default?: boolean;
    example?: boolean;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalEnumField<T extends EnumLike>(enumObject: T, options?: {
    default?: T[keyof T];
    example?: T[keyof T];
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalIntField(options?: {
    default?: number;
    example?: number;
    min?: number;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalDecimalField(options?: {
    default?: number;
    example?: number;
    min?: number;
    maxDecimalPlaces?: number;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export declare function OptionalSignedDecimalField(options?: {
    default?: number;
    example?: number;
    maxDecimalPlaces?: number;
    description?: string;
}): <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
export {};
