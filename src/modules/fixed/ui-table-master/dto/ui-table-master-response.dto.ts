import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class UiTableMasterErrorFieldDto {
  @ApiProperty({ example: 'uiTblName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate uiTblName is not allowed' })
  message!: string;
}

export class UiTableMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: UiTableMasterErrorFieldDto, isArray: true })
  errors!: UiTableMasterErrorFieldDto[];
}

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
}

export class UiTableMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
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

  @ApiProperty({ type: UiTableMasterListMetaDto })
  meta!: UiTableMasterListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class UiTableMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table deleted successfully' })
  message!: string;

  @ApiProperty({ type: UiTableMasterDeleteResultDto })
  data!: UiTableMasterDeleteResultDto;
}
