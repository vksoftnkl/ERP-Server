import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import { SaveUiTableColumnWidthDto } from './dto/save-ui-table-column-width.dto';
import { SaveUiTableVisibilitySettingsDto } from './dto/save-ui-table-visibility-settings.dto';
import { UiTableMasterListItem, UiTableMasterPayload } from './types/ui-table-master-api.types';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare class UiTableMasterService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveUiTableMasterDto: SaveUiTableMasterDto): Promise<UiTableMasterPayload>;
    list(queryDto: ListUiTableMasterQueryDto): Promise<{
        items: UiTableMasterListItem[];
    }>;
    getById(uiTblId: string): Promise<UiTableMasterPayload>;
    updateColumnWidths(dto: SaveUiTableColumnWidthDto): Promise<{
        updated: number;
    }>;
    updateVisibilitySettings(dto: SaveUiTableVisibilitySettingsDto): Promise<{
        updated: number;
    }>;
    softDelete(uiTblId: string): Promise<{
        uiTblId: string;
        deleted: true;
    }>;
    softDeleteColumn(uiTblClmId: string): Promise<{
        uiTblClmId: string;
        deleted: true;
    }>;
    private createUiTable;
    private updateUiTable;
    private saveColumnsInTx;
    private upsertColumnInTx;
    private ensureNameIsUnique;
    private normalizeRequiredName;
    private toPayload;
    private toColumnPayload;
    private resolveDisplayName;
    private parseBigIntId;
}
