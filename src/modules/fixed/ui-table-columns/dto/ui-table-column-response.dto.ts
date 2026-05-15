import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from '../../utils/fixed-response.dto';
export { FixedErrorFieldDto as UiTableColumnErrorFieldDto };
export { FixedErrorResponseDto as UiTableColumnErrorResponseDto };
export { FixedListMetaDto as UiTableColumnListMetaDto };

export class UiTableColumnPayloadDto {
  @ApiProperty({ example: '1', description: 'BigInt id serialized as string' })
  uiTblClmId!: string;

  @ApiProperty({ example: '10', description: 'BigInt column number serialized as string' })
  uiTblClmNo!: string;

  @ApiPropertyOptional({ example: 'Item Name', nullable: true })
  uiTblClmName!: string | null;

  @ApiPropertyOptional({
    example: '1',
    nullable: true,
    description: 'Related UI table id serialized as string',
  })
  uiTblClmTableId!: string | null;

  @ApiPropertyOptional({ example: 100, nullable: true })
  uiTblClmColumnWidth!: number | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  uiTblClmColumnVisibility!: boolean | null;

  @ApiPropertyOptional({ example: false, nullable: true })
  uiTblClmColumnFocus!: boolean | null;

  @ApiProperty({ example: 0 })
  uiTblClmColumnPosition!: number;

  @ApiProperty({ example: false })
  uiTblClmColumnNecessity!: boolean;

  @ApiPropertyOptional({ example: 2, nullable: true })
  uiTblClmNextColumn!: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  uiTblClmPreviousColumn!: number | null;

  @ApiProperty({ example: true })
  uiTblClmIsActive!: boolean;

  @ApiProperty({ example: false })
  uiTblClmIsDeleted!: boolean;

  @ApiPropertyOptional({
    example: '2026-03-12T06:34:47.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  uiTblClmSyncDate!: string | null;

  @ApiProperty({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' })
  uiTblClmCreatedOn!: string;

  @ApiPropertyOptional({ example: 'system', nullable: true })
  uiTblClmCreatedBy!: string | null;

  @ApiProperty({ example: '2026-03-12T06:34:47.000Z', type: String, format: 'date-time' })
  uiTblClmModifiedOn!: string;

  @ApiPropertyOptional({ example: 'system', nullable: true })
  uiTblClmModifiedBy!: string | null;
}

export class UiTableColumnDeleteResultDto {
  @ApiProperty({ example: '1', description: 'BigInt id serialized as string' })
  uiTblClmId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class UiTableColumnSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table column fetched successfully' })
  message!: string;

  @ApiProperty({ type: UiTableColumnPayloadDto })
  data!: UiTableColumnPayloadDto;
}

export class UiTableColumnSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table columns fetched successfully' })
  message!: string;

  @ApiProperty({ type: UiTableColumnPayloadDto, isArray: true })
  data!: UiTableColumnPayloadDto[];

  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class UiTableColumnSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'UI table column deleted successfully' })
  message!: string;

  @ApiProperty({ type: UiTableColumnDeleteResultDto })
  data!: UiTableColumnDeleteResultDto;
}
