import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { AccountLedgerMasterPayload, LedgerBankAccountPayload } from './types/account-ledger-master-api.types';
import type { AccountsWriteClient } from "../../../common/utils/module-service.utils";
import { RequestContextService } from '../../../common/request-context/request-context.service';
type AccountLedgerWriteClient = AccountsWriteClient;
export declare class AccountLedgerMastersService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto): Promise<AccountLedgerMasterPayload>;
    saveMany(saveAccountLedgerMasterDtos: SaveAccountLedgerMasterDto[]): Promise<AccountLedgerMasterPayload[]>;
    get(params: {
        ledId: string;
    }): Promise<AccountLedgerMasterPayload>;
    get(): Promise<{
        data: AccountLedgerMasterPayload[];
        total: number;
    }>;
    softDelete(ledId: string): Promise<{
        ledId: string;
        deleted: true;
    }>;
    private createLedger;
    createLedgerWithinTx(saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto, tx: AccountLedgerWriteClient): Promise<AccountLedgerMasterPayload>;
    private updateLedger;
    updateLedgerWithinTx(saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto, tx: AccountLedgerWriteClient): Promise<AccountLedgerMasterPayload>;
    private ensureGroupExists;
    private ensureNameIsUnique;
    private applyOptionalFields;
    private toPayload;
    getBankAccounts(params: {
        lbaId: string;
    }): Promise<LedgerBankAccountPayload>;
    getBankAccounts(params: {
        ledId: string;
    }): Promise<{
        data: LedgerBankAccountPayload[];
        total: number;
    }>;
    getBankAccounts(params: {
        lbaId?: string;
        ledId?: string;
    }): Promise<LedgerBankAccountPayload | {
        data: LedgerBankAccountPayload[];
        total: number;
    }>;
    deleteBankAccountById(lbaId: string): Promise<{
        lbaId: string;
        deleted: true;
    }>;
    private syncBankAccounts;
    private assertSingleDefault;
    private clearDefaultBankAccounts;
    private ensureBankAccountNumberIsUnique;
    private applyBankAccountOptionalFields;
    private loadBankAccounts;
    listBankAccountPayloads(ledId: string, client?: AccountLedgerWriteClient): Promise<LedgerBankAccountPayload[]>;
    private toBankAccountPayload;
}
export {};
