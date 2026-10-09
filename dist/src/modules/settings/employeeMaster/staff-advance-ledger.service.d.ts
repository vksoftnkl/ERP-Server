import { EmployeeMaster, Prisma } from '@prisma/client';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SettingsWriteClient } from "../../../common/utils/module-service.utils";
export declare const STAFF_ADVANCE_GROUP_NAME = "Loans & Advances (Asset)";
export declare const EMP_LEDGER_HAS_BALANCE = "EMP_LEDGER_HAS_BALANCE";
type EmployeeIdentity = Pick<EmployeeMaster, 'empId' | 'empName' | 'empCode' | 'empCompanyId' | 'empLoanLedgerId'>;
export declare function staffAdvanceLedgerNames(empName: string, empCode: string | null): string[];
export declare class StaffAdvanceLedgerService {
    private readonly accountLedgerMastersService;
    constructor(accountLedgerMastersService: AccountLedgerMastersService);
    settle(tx: SettingsWriteClient, record: EmployeeMaster, previous: EmployeeMaster | null, requestedId: string | null | undefined): Promise<EmployeeMaster>;
    liveLedgerOf(tx: SettingsWriteClient, employee: EmployeeIdentity): Promise<{
        ledId: string;
        ledName: string;
    } | null>;
    ensureSettled(tx: SettingsWriteClient, employee: EmployeeIdentity, ledger: {
        ledId: string;
        ledName: string;
    }): Promise<void>;
    retire(tx: SettingsWriteClient, ledger: {
        ledId: string;
        ledName: string;
    }, actor: string, now: Date): Promise<boolean>;
    balances(tx: SettingsWriteClient, ledId: string): Promise<Array<{
        companyId: string;
        balance: Prisma.Decimal;
    }>>;
    private ensurePickable;
    private isWithinGroup;
    private provision;
    private followRename;
    private firstFreeName;
    private nameTaken;
    private staffAdvanceGroupId;
    private refuse;
}
export {};
