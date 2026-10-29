import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import { LedgerBankAccountPayload } from './types/ledger-bank-account-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class LedgerBankAccountService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveLedgerBankAccountDto: SaveLedgerBankAccountDto): Promise<LedgerBankAccountPayload>;
    getById(lbaId: string): Promise<LedgerBankAccountPayload>;
    softDelete(lbaId: string): Promise<{
        lbaId: string;
        deleted: true;
    }>;
    private createLedgerBankAccount;
    private updateLedgerBankAccount;
    private ensureLedgerExists;
    private ensureCompanyExists;
    private resolveCompanyId;
    private ensureAccountNumberIsUnique;
    private clearDefaultAccount;
    private applyOptionalFields;
    private toPayload;
}
