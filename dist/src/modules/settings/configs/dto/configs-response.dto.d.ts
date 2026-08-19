export declare class ConfigsErrorFieldDto {
    field: string;
    message: string;
}
export declare class ConfigsErrorResponseDto {
    success: false;
    message: string;
    errors: ConfigsErrorFieldDto[];
}
export declare class ConfigsPayloadDto {
    configId: number;
    configName: string | null;
    configValue: string | null;
    configSyncDate: string | null;
    configCreatedOn: string | null;
    configCreatedBy: string | null;
    configModifiedOn: string | null;
    configModifiedBy: string | null;
}
export declare class ConfigsDeleteResultDto {
    configId: number;
    deleted: true;
}
export declare class ConfigsSuccessSingleDto {
    success: true;
    message: string;
    data: ConfigsPayloadDto;
}
export declare class ConfigsSuccessListDto {
    success: true;
    message: string;
    data: ConfigsPayloadDto[];
}
export declare class ConfigsSuccessDeleteDto {
    success: true;
    message: string;
    data: ConfigsDeleteResultDto;
}
