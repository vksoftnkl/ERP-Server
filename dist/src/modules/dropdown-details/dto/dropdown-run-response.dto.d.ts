export declare class DropdownRunMetaDto {
    page: number;
    limit: number;
    total: number;
}
export declare class DropdownRunDataDto {
    items: Record<string, unknown>[];
    meta: DropdownRunMetaDto;
}
export declare class DropdownRunResponseDto {
    success: boolean;
    message: string;
    data: DropdownRunDataDto;
}
