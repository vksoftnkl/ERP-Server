import type { Response } from 'express';
import { AppThemeService } from './app-theme.service';
import { AppThemeEffectiveQueryDto, AppThemeIdQueryDto } from './dto/app-theme-query.dto';
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import { SaveAppThemeTemplateDto } from './dto/save-app-theme-template.dto';
import type { AppThemeBootstrapPayload, AppThemeDeleteResult, AppThemeEffectiveWithTemplate, AppThemePayload, AppThemeSuccessResponse, AppThemeTemplatePayload } from './types/app-theme.types';
export declare class AppThemeController {
    private readonly appThemeService;
    constructor(appThemeService: AppThemeService);
    getById(query: AppThemeIdQueryDto): Promise<AppThemeSuccessResponse<AppThemePayload>>;
    effective(query: AppThemeEffectiveQueryDto, ifNoneMatch: string | undefined, res: Response): Promise<AppThemeSuccessResponse<AppThemeEffectiveWithTemplate> | undefined>;
    bootstrap(ifNoneMatch: string | undefined, res: Response): Promise<AppThemeSuccessResponse<AppThemeBootstrapPayload> | undefined>;
    template(): Promise<AppThemeSuccessResponse<AppThemeTemplatePayload>>;
    saveTemplate(dto: SaveAppThemeTemplateDto): Promise<AppThemeSuccessResponse<AppThemeTemplatePayload>>;
    save(dto: SaveAppThemeDto): Promise<AppThemeSuccessResponse<AppThemePayload>>;
    remove(query: AppThemeIdQueryDto): Promise<AppThemeSuccessResponse<AppThemeDeleteResult>>;
    restore(query: AppThemeIdQueryDto): Promise<AppThemeSuccessResponse<AppThemeDeleteResult>>;
}
