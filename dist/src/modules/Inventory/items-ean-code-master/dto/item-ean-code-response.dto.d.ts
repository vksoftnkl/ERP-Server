import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemEanCodeErrorFieldDto };
export { InventoryErrorResponseDto as ItemEanCodeErrorResponseDto };
export { InventoryListMetaDto as ItemEanCodeListMetaDto };
export declare class ItemEanCodePayloadDto {
    ean_id: string;
    ean_item_id: string;
    ean_unit_id: string;
    ean_code: string;
    ean_sl_no: number;
    ean_is_default: boolean;
    ean_is_active: boolean;
    ean_is_deleted: boolean;
    ean_created_on: string;
    ean_created_by: string | null;
    ean_modified_on: string;
    ean_modified_by: string | null;
    ean_remarks: string | null;
    ean_unit_name?: string | null;
}
export declare class ItemEanCodeDeleteResultDto {
    ean_id: string;
    deleted: boolean;
}
export declare class ItemEanCodeSuccessSingleDto {
    success: true;
    message: string;
    data: ItemEanCodePayloadDto;
}
export declare class ItemEanCodeSuccessSaveDto {
    success: true;
    message: string;
    data: ItemEanCodePayloadDto | ItemEanCodePayloadDto[];
}
export declare class ItemEanCodeSuccessListDto {
    success: true;
    message: string;
    data: ItemEanCodePayloadDto[];
    meta: InventoryListMetaDto;
}
export declare class ItemEanCodeSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemEanCodeDeleteResultDto | ItemEanCodeDeleteResultDto[];
}
