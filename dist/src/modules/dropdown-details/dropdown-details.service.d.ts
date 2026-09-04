import { PrismaService } from '../../database/prisma/prisma.service';
import { ConfiguredGridSqlService } from '../../common/configured-grid-sql/configured-grid-sql.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { RunDropdownQueryDto } from './dto/run-dropdown-query.dto';
import { DropdownDetailListItem, DropdownDetailPayload, DropdownRunResult } from './types/dropdown-detail-api.types';
export declare class DropdownDetailsService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly requestContextService;
    private readonly configuredGridSqlService;
    constructor(prisma: PrismaService, auditLogService: AuditLogService, requestContextService: RequestContextService, configuredGridSqlService: ConfiguredGridSqlService);
    save(saveDropdownDetailDto: SaveDropdownDetailDto): Promise<DropdownDetailPayload>;
    list(queryDto: ListDropdownDetailQueryDto): Promise<{
        items: DropdownDetailListItem[];
    }>;
    run(queryDto: RunDropdownQueryDto): Promise<DropdownRunResult>;
    private extractErrorMessage;
    updateColumnWidths(dto: SaveColumnWidthDto): Promise<{
        updated: number;
    }>;
    updateFilterSettings(dto: SaveFilterSettingsDto): Promise<{
        updated: number;
    }>;
    updateVisibilitySettings(dto: SaveVisibilitySettingsDto): Promise<{
        updated: number;
    }>;
    getById(dropdownId: string): Promise<DropdownDetailPayload>;
    delete(dropdownId: string): Promise<{
        dropdown_id: string;
        deleted: true;
    }>;
    deleteColumn(dropdown_columns_id: string): Promise<{
        dropdown_columns_id: string;
        deleted: true;
    }>;
    private createDropdownDetails;
    private updateDropdownDetails;
    private saveColumnsInTx;
    private upsertColumnInTx;
    private applyOptionalColumnFields;
    private applyOptionalDropdownFields;
    private toPayload;
    private toColumnPayload;
    private parseDropdownParam;
    private parseUuidId;
    private parseIntId;
}
