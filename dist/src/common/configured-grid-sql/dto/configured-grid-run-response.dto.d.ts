export declare class ConfiguredGridRunMetaDto {
    page: number;
    limit: number;
    total: number;
}
export declare class ConfiguredGridRunDataDto {
    items: Record<string, unknown>[];
    meta: ConfiguredGridRunMetaDto;
}
export declare class ConfiguredGridRunResponseDto {
    success: boolean;
    message: string;
    data: ConfiguredGridRunDataDto;
}
