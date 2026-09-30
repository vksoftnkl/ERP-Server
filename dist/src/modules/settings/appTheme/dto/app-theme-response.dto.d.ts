export declare class AppThemeErrorFieldDto {
    field: string;
    message: string;
}
export declare class AppThemeErrorResponseDto {
    success: false;
    message: string;
    errors: AppThemeErrorFieldDto[];
}
export declare class AppThemePayloadDto {
    thmId: number;
    thmName: string;
    thmBase: string;
    thmIsDefault: boolean;
    thmIsActive: boolean;
    thmIsDeleted: boolean;
    thmRemarks: string | null;
    tokens: Record<string, string>;
    usedByCount: number;
    thmModifiedOn: string | null;
}
export declare class AppThemeEffectivePayloadDto extends AppThemePayloadDto {
    resolvedFrom: 'COMPANY' | 'DEFAULT';
}
export declare class AppThemeSuccessSingleDto {
    success: true;
    message: string;
    data: AppThemePayloadDto;
}
export declare class AppThemeSuccessEffectiveDto {
    success: true;
    message: string;
    data: AppThemeEffectivePayloadDto;
}
export declare class AppThemeDeleteResultDto {
    thmId: number;
    deleted: boolean;
}
export declare class AppThemeSuccessDeleteDto {
    success: true;
    message: string;
    data: AppThemeDeleteResultDto;
}
