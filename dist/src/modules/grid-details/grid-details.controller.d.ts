import { ListGridDetailQueryDto } from './dto/list-grid-detail-query.dto';
import { SaveGridDetailDto } from './dto/save-grid-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { GridDetailsService } from './grid-details.service';
import { GridDetailListItem, GridDetailPayload, GridDetailSuccessResponse } from './types/grid-detail-api.types';
export declare class GridDetailsController {
    private readonly gridDetailsService;
    constructor(gridDetailsService: GridDetailsService);
    save(saveGridDetailDto: SaveGridDetailDto): Promise<GridDetailSuccessResponse<GridDetailPayload>>;
    list(queryDto: ListGridDetailQueryDto): Promise<GridDetailSuccessResponse<GridDetailListItem[]>>;
    updateColumnWidths(dto: SaveColumnWidthDto): Promise<GridDetailSuccessResponse<{
        updated: number;
    }>>;
    updateFilterSettings(dto: SaveFilterSettingsDto): Promise<GridDetailSuccessResponse<{
        updated: number;
    }>>;
    updateVisibilitySettings(dto: SaveVisibilitySettingsDto): Promise<GridDetailSuccessResponse<{
        updated: number;
    }>>;
    removeColumn(gridColumnId?: string): Promise<GridDetailSuccessResponse<{
        grid_column_id: string;
        deleted: true;
    }>>;
    remove(gridId?: string): Promise<GridDetailSuccessResponse<{
        grid_id: string;
        deleted: true;
    }>>;
}
