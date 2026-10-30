import { ListDropdownDetailQueryDto } from './dto/list-dropdown-detail-query.dto';
import { RunDropdownQueryDto } from './dto/run-dropdown-query.dto';
import { DropdownRunResponseDto } from './dto/dropdown-run-response.dto';
import { SaveDropdownDetailDto } from './dto/save-dropdown-detail.dto';
import { SaveColumnWidthDto } from './dto/save-column-width.dto';
import { SaveFilterSettingsDto } from './dto/save-filter-settings.dto';
import { SaveVisibilitySettingsDto } from './dto/save-visibility-settings.dto';
import { DropdownDetailsService } from './dropdown-details.service';
import { DropdownDetailListItem, DropdownDetailPayload, DropdownDetailSuccessResponse } from './types/dropdown-detail-api.types';
export declare class DropdownDetailsController {
    private readonly dropdownDetailsService;
    constructor(dropdownDetailsService: DropdownDetailsService);
    save(saveDropdownDetailDto: SaveDropdownDetailDto): Promise<DropdownDetailSuccessResponse<DropdownDetailPayload>>;
    list(queryDto: ListDropdownDetailQueryDto): Promise<DropdownDetailSuccessResponse<DropdownDetailListItem[]>>;
    run(queryDto: RunDropdownQueryDto): Promise<DropdownRunResponseDto>;
    updateColumnWidths(dto: SaveColumnWidthDto): Promise<DropdownDetailSuccessResponse<{
        updated: number;
    }>>;
    updateFilterSettings(dto: SaveFilterSettingsDto): Promise<DropdownDetailSuccessResponse<{
        updated: number;
    }>>;
    updateVisibilitySettings(dto: SaveVisibilitySettingsDto): Promise<DropdownDetailSuccessResponse<{
        updated: number;
    }>>;
    removeColumn(dropdownColumnsId?: string): Promise<DropdownDetailSuccessResponse<{
        dropdown_columns_id: string;
        deleted: true;
    }>>;
    remove(dropdownId?: string): Promise<DropdownDetailSuccessResponse<{
        dropdown_id: string;
        deleted: true;
    }>>;
}
