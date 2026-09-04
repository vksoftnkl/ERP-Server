import { AppSettingValueService } from './app-setting-value.service';
import { ResolveAppSettingsQueryDto } from './dto/resolve-app-settings-query.dto';
import { SaveBulkAppSettingValueDto } from './dto/save-bulk-app-setting-value.dto';
import { AppSettingEffectiveItem, AppSettingValueDeleteResult, AppSettingValuePayload, AppSettingsSuccessResponse } from './types/app-settings-api.types';
export declare class AppSettingValueController {
    private readonly appSettingValueService;
    constructor(appSettingValueService: AppSettingValueService);
    save(saveDto: SaveBulkAppSettingValueDto): Promise<AppSettingsSuccessResponse<AppSettingValuePayload[]>>;
    effective(queryDto: ResolveAppSettingsQueryDto): Promise<AppSettingsSuccessResponse<AppSettingEffectiveItem[]>>;
    remove(asvId: string): Promise<AppSettingsSuccessResponse<AppSettingValueDeleteResult>>;
}
