export interface MobileMenuRights {
    view: boolean;
    create: boolean;
    post: boolean;
    cancel: boolean;
    print: boolean;
}
export interface MobileMe {
    userId: string;
    loginName: string;
    employeeId: string | null;
    employeeName: string | null;
    rights: Record<string, MobileMenuRights>;
}
