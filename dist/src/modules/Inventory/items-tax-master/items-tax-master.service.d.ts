import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemTaxPayload } from './types/item-tax-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsTaxMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemTaxDto: SaveItemTaxDto): Promise<ItemTaxPayload>;
    getById(taxId: string): Promise<ItemTaxPayload>;
    private loadLedgerNameMap;
    private ledgerName;
    toggleDelete(taxId: string): Promise<{
        tax_id: string;
        deleted: boolean;
    }>;
    private createItemTax;
    private updateItemTax;
    private applyOptionalFields;
    private toPayload;
    private handleWriteError;
}
