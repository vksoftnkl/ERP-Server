import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
export type CogsMode = 'PERPETUAL' | 'PERIODIC';
export interface CogsModeResolver {
    cogsMode(companyId: string, branchId: string): Promise<CogsMode>;
}
export declare class StockCogsModeService implements CogsModeResolver {
    private readonly appSettings;
    constructor(appSettings: AppSettingValueService);
    cogsMode(companyId: string, branchId: string): Promise<CogsMode>;
}
