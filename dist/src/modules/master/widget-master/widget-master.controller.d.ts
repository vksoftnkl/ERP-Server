import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { WidgetConfigQueryDto } from './dto/widget-config-query.dto';
import { UpdateWidgetVisibilityDto } from './dto/update-widget-visibility.dto';
import { SaveWidgetDto } from './dto/save-widget.dto';
import { SaveBulkWidgetDto } from './dto/save-bulk-widget.dto';
import { WidgetMasterPayload, WidgetMasterSuccessResponse } from './types/widget-master-api.types';
import { WidgetMasterService } from './widget-master.service';
export declare class WidgetMasterController {
    private readonly widgetMasterService;
    constructor(widgetMasterService: WidgetMasterService);
    save(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload>>;
    saveBulk(saveBulkWidgetDto: SaveBulkWidgetDto): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>>;
    list(queryDto: ListWidgetQueryDto): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>>;
    getConfig(queryDto: WidgetConfigQueryDto): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>>;
    updateVisibility(updateWidgetVisibilityDto: UpdateWidgetVisibilityDto): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[]>>;
    remove(sectionId: number): Promise<WidgetMasterSuccessResponse<{
        sectionId: number;
        deleted: true;
    }>>;
}
