import { ModuleErrorFieldDto, ModuleErrorResponseDto } from '../../../common/utils/module-response.dto';
export { ModuleErrorFieldDto as AuditLogErrorFieldDto, ModuleErrorResponseDto as AuditLogErrorResponseDto };
export declare class AuditLogListItemDto {
    log_id: string;
    log_date: string;
    log_action: string;
    log_screen_id: number;
    screen_name: string;
    log_table_name: string;
    log_pk: string | null;
    log_display_name: string | null;
    log_original_record: unknown;
    log_modified_record: unknown;
    log_changed_fields: unknown;
    log_user_id: string | null;
    log_user_name: string | null;
    log_branch_id: string | null;
    log_branch_name: string | null;
    log_notes: string | null;
}
export declare class AuditLogListMetaDto {
    page: number | null;
    limit: number;
    total: number | null;
    total_pages: number | null;
    next_cursor: string | null;
}
export declare class AuditLogSuccessListDto {
    success: true;
    message: string;
    data: AuditLogListItemDto[];
    meta: AuditLogListMetaDto;
}
