export declare class CostBulkLevelDto {
    level: number;
    price: number;
    priceWot: number;
    markupPerc: number;
    active: boolean;
}
export declare class CostBulkRightsDto {
    view: boolean;
    edit: boolean;
    override: boolean;
}
export declare class CostBulkRowDto {
    lineNo: number;
    ipmId: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    barcode: string | null;
    uomId: string;
    unitName: string | null;
    unitSlno: number;
    parentUomId: string | null;
    parentUnitName: string | null;
    unitsPerParent: number | null;
    toBaseFactor: number;
    unitFactor: number;
    factorsAgree: boolean;
    priceScope: string;
    companyShared: boolean;
    profitType: string;
    roundOff: number;
    taxPerc: number;
    costPrice: number;
    costWot: number;
    mrp: number;
    minPrice: number;
    levels: CostBulkLevelDto[];
    scheduledFrom: string | null;
    hasQtySlabs: boolean;
    updatedOn: string | null;
    rowToken: string;
}
export declare class CostBulkLeftOutDto {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    uomId: string | null;
    trackedAs: string;
    reasonCode: string;
    reason: string;
}
export declare class CostBulkLeftOutCountsDto {
    NOT_PLAIN_STOCK: number;
    OLD_BATCH_TICK: number;
    NO_PRICE_ROW: number;
    INACTIVE: number;
}
export declare class CostBulkListDataDto {
    items: CostBulkRowDto[];
    total: number;
    totalItems: number;
    page: number;
    limit: number;
    leftOut: CostBulkLeftOutDto[];
    leftOutTotal: number;
    leftOutCounts: CostBulkLeftOutCountsDto;
    today: string;
    belowCostPolicy: string;
    rights: CostBulkRightsDto;
}
export declare class CostBulkListSuccessDto {
    success: true;
    message: string;
    data: CostBulkListDataDto;
}
export declare class CostBulkNoteDto {
    code: string;
    level: string;
    message: string;
    field: string;
    line: number;
    ipmId: string;
    overridable: boolean;
}
export declare class CostBulkCountsDto {
    rows: number;
    changed: number;
    unchanged: number;
    refused: number;
    warned: number;
}
export declare class CostBulkValidateDataDto {
    ok: boolean;
    refusals: CostBulkNoteDto[];
    warnings: CostBulkNoteDto[];
    rights: CostBulkRightsDto;
    counts: CostBulkCountsDto;
    belowCostPolicy: string;
}
export declare class CostBulkValidateSuccessDto {
    success: true;
    message: string;
    data: CostBulkValidateDataDto;
}
export declare class CostBulkSavedRowDto extends CostBulkRowDto {
    written: boolean;
    sourceIpmId: string;
    companyCopy: boolean;
}
export declare class CostBulkSaveDataDto {
    saved: number;
    unchanged: number;
    rows: CostBulkSavedRowDto[];
    warnings: CostBulkNoteDto[];
    refusals: CostBulkNoteDto[];
    rights: CostBulkRightsDto;
    counts: CostBulkCountsDto;
    belowCostPolicy: string;
}
export declare class CostBulkSaveSuccessDto {
    success: true;
    message: string;
    data: CostBulkSaveDataDto;
}
export declare class CostBulkErrorDetailDto {
    field: string;
    code: string;
    message: string;
    line?: number;
    level?: string;
    reasonCode?: string;
    trackedAs?: string;
}
export declare class CostBulkErrorResponseDto {
    success: false;
    message: string;
    errors: CostBulkErrorDetailDto[];
    refusals?: CostBulkNoteDto[];
    warnings?: CostBulkNoteDto[];
}
