export declare class AgeingSlabsCompanyDto {
    companyId: string;
}
export declare class AgeingSlabDto {
    slabNo: number;
    label: string;
    fromDays: number;
    toDays?: number | null;
}
export declare class SaveAgeingSlabsDto extends AgeingSlabsCompanyDto {
    slabs: AgeingSlabDto[];
}
