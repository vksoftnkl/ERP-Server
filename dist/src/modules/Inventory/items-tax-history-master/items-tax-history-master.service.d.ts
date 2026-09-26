import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import { ItemTaxHistoryPayload } from './types/item-tax-history-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class ItemsTaxHistoryMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveItemTaxHistoryDto: SaveItemTaxHistoryDto): Promise<ItemTaxHistoryPayload>;
    getById(ithId: string): Promise<ItemTaxHistoryPayload>;
    delete(ithId: string): Promise<{
        ith_id: string;
        deleted: true;
    }>;
    private createItemTaxHistory;
    private updateItemTaxHistory;
    private applyOptionalFields;
    private parseRequiredDate;
    private parseOptionalDate;
    private validateDateRange;
    private toPayload;
    private buildDisplayName;
    private handleWriteError;
    private handleDeleteError;
}
