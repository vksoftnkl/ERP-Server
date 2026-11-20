export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class ChangePasswordResultDto {
    usrId: string;
    usrPasswordChangedOn: string;
    usrMustChangePassword: boolean;
}
export declare class ChangePasswordResponseDto {
    success: boolean;
    message: string;
    data: ChangePasswordResultDto;
}
