import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as GodownErrorFieldDto };
export { InventoryErrorResponseDto as GodownErrorResponseDto };
export class GodownPayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  gdl_id!: string;
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd07' })
  gdl_branch_id!: string;
  @ApiProperty({ example: 'Rack A1' })
  gdl_name!: string;
  @ApiPropertyOptional({ nullable: true, example: 'A1' })
  gdl_short!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'RACK-A1' })
  gdl_code!: string | null;
  @ApiProperty({ example: 'BIN' })
  gdl_type!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  gdl_parent_id!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Warehouse',
    description: 'Name of the parent godown location (resolved on the get endpoint)',
  })
  gdl_parent_name?: string | null;
  @ApiProperty({ example: 1 })
  gdl_sort!: number;
  @ApiProperty({ example: 0 })
  gdl_level!: number;
  @ApiProperty({ type: [String], example: [] })
  gdl_path_ids_cache!: string[];
  @ApiProperty({ example: false })
  gdl_del_sheet!: boolean;
  @ApiProperty({ example: false })
  gdl_split_stock!: boolean;
  @ApiProperty({ example: false })
  gdl_negative_stock!: boolean;
  @ApiProperty({ example: 0 })
  gdl_volume!: number;
  @ApiProperty({ example: true })
  gdl_is_active!: boolean;
  @ApiProperty({ example: false })
  gdl_is_deleted!: boolean;
  @ApiProperty({ example: '2026-02-20T10:15:30.000Z' })
  gdl_created_on!: string;
  @ApiPropertyOptional({ nullable: true, example: 'system' })
  gdl_created_by!: string | null;
  @ApiProperty({ example: '2026-02-20T10:15:30.000Z' })
  gdl_modified_on!: string;
  @ApiPropertyOptional({ nullable: true, example: 'system' })
  gdl_modified_by!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Ground floor zone' })
  gdl_remarks!: string | null;
}
export class GodownDeleteResultDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  gdl_id!: string;
  @ApiProperty({
    example: true,
    description: 'true when the godown location was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}
export class GodownSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Godown location fetched successfully' })
  message!: string;
  @ApiProperty({ type: GodownPayloadDto })
  data!: GodownPayloadDto;
}
export class GodownSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Godown location deleted successfully' })
  message!: string;
  @ApiProperty({ type: GodownDeleteResultDto })
  data!: GodownDeleteResultDto;
}