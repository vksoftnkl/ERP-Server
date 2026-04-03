import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogErrorFieldDto {
  @ApiProperty({ example: 'date_from' })
  field!: string;

  @ApiProperty({ example: 'date_from must be less than or equal to date_to' })
  message!: string;
}

export class AuditLogErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation error' })
  message!: string;

  @ApiProperty({ type: AuditLogErrorFieldDto, isArray: true })
  errors!: AuditLogErrorFieldDto[];
}

export class AuditLogListItemDto {
  @ApiProperty({ format: 'uuid' })
  log_id!: string;

  @ApiProperty({ example: '2026-02-20T10:30:00.000Z' })
  log_date!: string;

  @ApiProperty({ example: 'New' })
  log_action!: string;

  @ApiProperty({ example: 1 })
  log_screen_id!: number;

  @ApiProperty({ example: 'Item Group Master' })
  screen_name!: string;

  @ApiProperty({ example: 'item_group_master' })
  log_table_name!: string;

  @ApiPropertyOptional({ nullable: true })
  log_pk!: string | null;

  @ApiPropertyOptional({ nullable: true })
  log_display_name!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  log_original_record!: unknown;

  @ApiPropertyOptional({ nullable: true, type: Object })
  log_modified_record!: unknown;

  @ApiPropertyOptional({ nullable: true, type: Object })
  log_changed_fields!: unknown;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  log_user_id!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Admin User' })
  log_user_name!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  log_branch_id!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Head Office' })
  log_branch_name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  log_notes!: string | null;
}

export class AuditLogListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  total_pages!: number;
}

export class AuditLogSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Audit logs fetched successfully' })
  message!: string;

  @ApiProperty({ type: AuditLogListItemDto, isArray: true })
  data!: AuditLogListItemDto[];

  @ApiProperty({ type: AuditLogListMetaDto })
  meta!: AuditLogListMetaDto;
}
