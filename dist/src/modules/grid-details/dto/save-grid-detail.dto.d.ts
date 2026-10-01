import { gridDeviceTypeEnum } from '../types/grid-detail-enum';
import { SaveGridColumnDto } from './save-grid-column.dto';
export declare class SaveGridDetailDto {
    grid_id?: string;
    grid_name: string;
    grid_description?: string | null;
    grid_sort_column?: string | null;
    grid_sort_order?: string | null;
    grid_sql?: string | null;
    grid_status?: boolean;
    grid_device_type: gridDeviceTypeEnum;
    grid_columns?: SaveGridColumnDto[];
    replace_columns?: boolean;
}
