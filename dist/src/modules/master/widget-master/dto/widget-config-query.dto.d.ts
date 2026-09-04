import { WidgetPlatform, WidgetVisibilityFilter } from '../types/widget-master-api.types';
export declare class WidgetConfigQueryDto {
    menu_id: number;
    visibility?: WidgetVisibilityFilter;
    platform?: WidgetPlatform;
}
