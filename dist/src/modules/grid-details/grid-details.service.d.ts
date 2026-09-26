import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { GridDetailListItem, GridDetailPayload } from './types/grid-detail-api.types';
export declare class GridDetailsService {
    private readonly prisma;
    private readonly configuredGridSqlService;
    private readonly auditLogService;
    private readonly requestContextService;
    constructor(prisma: PrismaService, configuredGridSqlService: ConfiguredGridSqlService, auditLogService: AuditLogService, requestContextService: RequestContextService);
    save(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailPayload>;
    list(queryDto: ListGridDetailQueryDto): Promise<{
        items: GridDetailListItem[];
    }>;
    updateColumnWidths(dto: SaveColumnWidthDto): Promise<{
        updated: number;
    }>;
    updateFilterSettings(dto: SaveFilterSettingsDto): Promise<{
        updated: number;
    }>;
    updateVisibilitySettings(dto: SaveVisibilitySettingsDto): Promise<{
        updated: number;
    }>;
    getById(gridId: string): Promise<GridDetailPayload>;
    softDelete(gridId: string): Promise<{
        grid_id: string;
        deleted: true;
    }>;
    softDeleteColumn(grid_column_id: string): Promise<{
        grid_column_id: string;
        deleted: true;
    }>;
    private createGridDetails;
    private updateGridDetails;
    private saveColumnsInTx;
    private upsertColumnInTx;
    private applyOptionalColumnFields;
    private applyOptionalGridFields;
    private normalizeGridSql;
    private toPayload;
    private toColumnPayload;
    private parseUuidId;
    private parseBigIntId;
}
