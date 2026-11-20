import type { MobileReadClient } from './mobile-scope';
export interface MobileLogin {
    userId: string;
    loginName: string;
    employeeId: string | null;
    employeeName: string | null;
}
export declare function findMobileLogin(client: MobileReadClient, userId: string): Promise<MobileLogin | null>;
export declare function requireMobileLoginRow(client: MobileReadClient, userId: string): Promise<MobileLogin>;
