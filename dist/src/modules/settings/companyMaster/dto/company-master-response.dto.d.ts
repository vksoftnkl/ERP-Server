export declare class CompanyMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class CompanyMasterErrorResponseDto {
    success: false;
    message: string;
    errors: CompanyMasterErrorFieldDto[];
}
export declare class CompanyMasterPayloadDto {
    compId: string;
    compCode: string | null;
    compName: string;
    compShort: string | null;
    compLegalName: string | null;
    compGstinNo: string | null;
    compGstRegType: string | null;
    compPanNo: string | null;
    compTanNo: string | null;
    compCinNo: string | null;
    compFssaiNo: string | null;
    compDrugLicenseNo: string | null;
    compAddr1: string | null;
    compAddr2: string | null;
    compAddr3: string | null;
    compCity: string | null;
    compDistrict: string | null;
    compState: string | null;
    compStateCode: string;
    compPin: number | null;
    compCountry: string;
    compRegionAddr1: string | null;
    compRegionAddr2: string | null;
    compRegionAddr3: string | null;
    compRegionCity: string | null;
    compRegionDistrict: string | null;
    compRegionState: string | null;
    compRegionCountry: string | null;
    compRegionName: string | null;
    compTel: string | null;
    compPhone: string | null;
    compMail: string | null;
    compSupportEmail: string | null;
    compSupportPhone: string | null;
    compWebsiteName: string | null;
    compFinYearFrom: string | null;
    compFinYearTo: string | null;
    compBooksBeginFrom: string | null;
    compBooksLockDate: string | null;
    compGstApplicable: boolean;
    compTcsApplicable: boolean;
    compSmsApplicable: boolean;
    compEinvoiceApplicable: boolean;
    compEwayApplicable: boolean;
    compEwayDate: string | null;
    compEwayInterLimit: number | null;
    compEwayIntraApl: boolean;
    compEwayIntraLimit: number;
    compEinvoiceDate: string | null;
    compEinvoiceInclEway: boolean | null;
    compStylesheetId: number;
    compStylesheetName: string | null;
    compBankId: string | null;
    compBankName: string | null;
    compPriceFixing: string | null;
    compPrefixCode: string | null;
    compBillGreeting: string | null;
    compNegStkApl: boolean;
    compDefault: boolean;
    compIsActive: boolean;
    compCurrencyCode: string;
    compCurrencySymbol: string | null;
    compLocaleCode: string;
    compRemarks: string | null;
    compAuthorizeSignature: string | null;
    compIsDeleted: boolean;
    compSyncDate: string | null;
    compCreatedOn: string;
    compCreatedBy: string | null;
    compModifiedOn: string;
    compModifiedBy: string | null;
}
export declare class CompanyMasterDeleteResultDto {
    compId: string;
    deleted: true;
}
export declare class CompanyMasterSuccessSingleDto {
    success: true;
    message: string;
    data: CompanyMasterPayloadDto;
}
export declare class CompanyMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: CompanyMasterDeleteResultDto;
}
