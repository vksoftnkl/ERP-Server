export declare class LedgerMapErrorFieldDto {
    field: string;
    message: string;
}
export declare class LedgerMapErrorResponseDto {
    success: false;
    message: string;
    errors: LedgerMapErrorFieldDto[];
}
export declare class LedgerMapRolePayloadDto {
    role: string;
    label: string;
    group: string;
    sortOrder: number;
    expectedLedgerType: string | null;
    expectedDutyHead: string | null;
    expectedGroupNature: string | null;
    roleIsActive: boolean;
    usedBy: string[];
    almId: string | null;
    ledgerId: string | null;
    ledgerName: string | null;
    ledgerIsActive: boolean | null;
    ledgerIsDeleted: boolean | null;
    isActive: boolean | null;
    remarks: string | null;
}
export declare class LedgerMapDeleteResultDto {
    almId: string;
    role: string;
    deleted: true;
}
export declare class LedgerMapRolesSuccessDto {
    success: true;
    message: string;
    data: LedgerMapRolePayloadDto[];
}
export declare class LedgerMapSuccessSingleDto {
    success: true;
    message: string;
    data: LedgerMapRolePayloadDto;
}
export declare class LedgerMapSuccessDeleteDto {
    success: true;
    message: string;
    data: LedgerMapDeleteResultDto;
}
