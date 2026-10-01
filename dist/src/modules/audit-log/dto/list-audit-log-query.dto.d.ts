import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';
export declare class ListAuditLogQueryDto extends ModuleListQueryBaseDto {
    action?: string;
    screen_id?: number;
    screen_name?: string;
    record_pk?: string;
    date_from?: string;
    date_to?: string;
    cursor?: string;
    include_total?: boolean;
}
