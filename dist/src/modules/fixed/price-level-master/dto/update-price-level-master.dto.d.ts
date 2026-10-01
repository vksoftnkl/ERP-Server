export declare class UpdatePriceLevelItemDto {
    priceLvlId: number;
    priceLvlName?: string;
    priceLvlShort?: string | null;
    priceLvlIsActive?: boolean;
    priceLvlIsAdmin?: boolean;
}
export declare class UpdatePriceLevelMasterDto {
    priceLevels: UpdatePriceLevelItemDto[];
}
