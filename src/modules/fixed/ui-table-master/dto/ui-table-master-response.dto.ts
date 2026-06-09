import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from 'src/common/utils/module-response.dto';
import { UiTableColumnPayloadDto } from './ui-table-column-response.dto';
export { FixedErrorFieldDto as UiTableMasterErrorFieldDto };
export { FixedErrorResponseDto as UiTableMasterErrorResponseDto };
export { FixedListMetaDto as UiTableMasterListMetaDto };

export class UiTableMasterPayloadDto {
  @ApiProperty({ example: '1', description: 'BigInt id serialized as string' })
  uiTblId!: string;

  @ApiPropertyOptional({ example: 'Item Master Grid', nullable: true })
  uiTblName!: string | null;

  @ApiProperty({ example: false })
  uiTblEditable!: boolean;

  @ApiProperty({ example: true })
  uiTblIsActive!: boolean;

  @ApiProperty({ example: false })
  uiTblIsDeleted!: boolean;

  @ApiPropertyOptional({
    example: '2026-03-12T06:34:47.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  uiTblSyncDate!: string | null;

  @ApiProperty({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' })
  uiTblCreatedOn!: string;

  @ApiPropertyOptional({ example: 'system', nullable: true })
  uiTblCreatedBy!: string | null;

  @ApiProperty({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' })
  uiTblModifiedOn!: string;

  @ApiPropertyOptional({ example: 'system', nullable: true })
  uiTblModifiedBy!: string | null;

  @ApiPropertyOptional({ example: 'mobile', nullable: true })
  uiTblDeviceType!: string | null;

  @ApiProperty({ type: [UiTableColumnPayloadDto], description: 'Columns belonging to this UI table' })
  columns!: UiTableColumnPayloadDto[];
}

export class UiTableMasterDeleteResultDto {
  @ApiProperty({ example: '1', description: 'BigInt id serialized as string' })
  uiTblId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class UiTableMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table fetched successfully' })
  message!: string;

  @ApiProperty({ type: UiTableMasterPayloadDto })
  data!: UiTableMasterPayloadDto;
}

export class UiTableMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI tables fetched successfully' })
  message!: string;

  @ApiProperty({ type: UiTableMasterPayloadDto, isArray: true })
  data!: UiTableMasterPayloadDto[];

  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;
}

export class UiTableMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table deleted successfully' })
  message!: string;

  @ApiProperty({ type: UiTableMasterDeleteResultDto })
  data!: UiTableMasterDeleteResultDto;
}
