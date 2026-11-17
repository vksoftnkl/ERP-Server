export declare const MOBILE_ITEM_DEFAULT_PAGE_SIZE = 200;
export declare const MOBILE_ITEM_MAX_PAGE_SIZE = 500;
export declare const MOBILE_DEVICE_UID_MAX_LENGTH = 120;
export declare class ListMobileItemsQueryDto {
    companyId: string;
    deviceUid?: string;
    page?: number;
    pageSize?: number;
}
