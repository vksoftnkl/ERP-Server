import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { LedgerShippingAddressPayload } from './types/ledger-shipping-address-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class LedgerShippingAddressService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto): Promise<LedgerShippingAddressPayload>;
    getById(saaId: string): Promise<LedgerShippingAddressPayload>;
    softDelete(saaId: string): Promise<{
        saaId: string;
        deleted: true;
    }>;
    private createAddress;
    private updateAddress;
    private ensureLedgerExists;
    private ensureCompanyExists;
    private ensureBranchExists;
    private clearDefaultAddress;
    private applyOptionalFields;
    private resolveCountryCode;
    private resolveDisplayName;
    private toPayload;
}
