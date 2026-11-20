declare class MobileMenuRightsDto {
    view: boolean;
    create: boolean;
    post: boolean;
    cancel: boolean;
    print: boolean;
}
declare class MobileMeRightsDto {
    '11': MobileMenuRightsDto;
    '12': MobileMenuRightsDto;
    '99': MobileMenuRightsDto;
}
export declare class MobileMeDto {
    userId: string;
    loginName: string;
    employeeId: string | null;
    employeeName: string | null;
    rights: MobileMeRightsDto;
}
export declare class MobileMeSuccessDto {
    success: true;
    message: string;
    data: MobileMeDto;
}
export {};
