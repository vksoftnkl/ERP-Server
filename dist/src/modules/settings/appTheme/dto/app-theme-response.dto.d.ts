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
export declare class AppThemeTemplateRefDto {
    tplId: number;
    tplQss: string;
    tplModifiedOn: string;
}
export declare class AppThemeEffectivePayloadDto extends AppThemePayloadDto {
    resolvedFrom: 'COMPANY' | 'DEFAULT';
    template: AppThemeTemplateRefDto | null;
}
export declare class AppThemeTemplatePayloadDto extends AppThemeTemplateRefDto {
    tplName: string;
    tplRemarks: string | null;
    placeholders: string[];
}
export declare class AppThemeSuccessTemplateDto {
    success: true;
    message: string;
    data: AppThemeTemplatePayloadDto;
}
export declare class AppThemeBootstrapPayloadDto {
    tokens: Record<string, string>;
    thmModifiedOn: string | null;
    template: AppThemeTemplateRefDto | null;
}
export declare class AppThemeSuccessBootstrapDto {
    success: true;
    message: string;
    data: AppThemeBootstrapPayloadDto;
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
