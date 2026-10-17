import { ListUiTableMasterQueryDto } from './dto/list-ui-table-master-query.dto';
import { SaveUiTableMasterDto } from './dto/save-ui-table-master.dto';
import { SaveUiTableColumnWidthDto } from './dto/save-ui-table-column-width.dto';
import { SaveUiTableVisibilitySettingsDto } from './dto/save-ui-table-visibility-settings.dto';
import { UiTableMasterService } from './ui-table-master.service';
import { UiTableMasterListItem, UiTableMasterPayload, UiTableMasterSuccessResponse } from './types/ui-table-master-api.types';
export declare class UiTableMasterController {
    private readonly uiTableMasterService;
    constructor(uiTableMasterService: UiTableMasterService);
    save(saveUiTableMasterDto: SaveUiTableMasterDto): Promise<UiTableMasterSuccessResponse<UiTableMasterPayload>>;
    list(queryDto: ListUiTableMasterQueryDto): Promise<UiTableMasterSuccessResponse<UiTableMasterListItem[]>>;
    updateColumnWidths(dto: SaveUiTableColumnWidthDto): Promise<UiTableMasterSuccessResponse<{
        updated: number;
    }>>;
    updateVisibilitySettings(dto: SaveUiTableVisibilitySettingsDto): Promise<UiTableMasterSuccessResponse<{
        updated: number;
    }>>;
    removeColumn(uiTblClmId?: string): Promise<UiTableMasterSuccessResponse<{
        uiTblClmId: string;
        deleted: true;
    }>>;
    remove(uiTblId?: string): Promise<UiTableMasterSuccessResponse<{
        uiTblId: string;
        deleted: true;
    }>>;
}
