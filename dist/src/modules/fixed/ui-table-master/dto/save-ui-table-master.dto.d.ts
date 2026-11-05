import { SaveUiTableColumnDto } from './save-ui-table-column.dto';
export declare class SaveUiTableMasterDto {
    uiTblId?: string;
    uiTblName: string;
    uiTblEditable?: boolean;
    uiTblIsActive?: boolean;
    uiTblDeviceType?: string | null;
    uiTblColumns?: SaveUiTableColumnDto[];
    replaceColumns?: boolean;
}
