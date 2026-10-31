import type { ModuleErrorDetail } from "../../../../common/utils/module-shared.utils";
export declare enum ItemSizeErrorCode {
    NOT_FOUND = "ITEM_SIZE_NOT_FOUND",
    NAME_TAKEN = "ITEM_SIZE_NAME_TAKEN",
    IN_USE = "ITEM_SIZE_IN_USE",
    ALREADY_DELETED = "ITEM_SIZE_ALREADY_DELETED",
    NOT_DELETED = "ITEM_SIZE_NOT_DELETED",
    COMPANY_NOT_FOUND = "ITEM_SIZE_COMPANY_NOT_FOUND"
}
export declare enum ItemColourErrorCode {
    NOT_FOUND = "ITEM_COLOUR_NOT_FOUND",
    NAME_TAKEN = "ITEM_COLOUR_NAME_TAKEN",
    IN_USE = "ITEM_COLOUR_IN_USE",
    ALREADY_DELETED = "ITEM_COLOUR_ALREADY_DELETED",
    NOT_DELETED = "ITEM_COLOUR_NOT_DELETED",
    COMPANY_NOT_FOUND = "ITEM_COLOUR_COMPANY_NOT_FOUND"
}
export interface ItemAttributeErrorCodes {
    NOT_FOUND: string;
    NAME_TAKEN: string;
    IN_USE: string;
    ALREADY_DELETED: string;
    NOT_DELETED: string;
    COMPANY_NOT_FOUND: string;
}
export interface ItemAttributeErrorDetail extends ModuleErrorDetail {
    existingId?: string;
}
export interface ItemAttributeMasterConfig {
    table: 'item_size_master' | 'item_colour_master';
    prefix: 'isz' | 'icl';
    label: string;
    auditScreenName: string;
    restoreRoute: string;
    batchDetailColumn: 'sbd_size_id' | 'sbd_colour_id';
    hasSizeSet: boolean;
    codes: ItemAttributeErrorCodes;
}
export type ItemAttributePayload = Record<string, string | number | boolean | null>;
