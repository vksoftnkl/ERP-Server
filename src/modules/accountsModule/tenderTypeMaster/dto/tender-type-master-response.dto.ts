import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class TenderTypeMasterErrorFieldDto {
  @ApiProperty({ example: 'ttmTypeName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate ttmTypeName is not allowed' })
  message!: string;
}

export class TenderTypeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: TenderTypeMasterErrorFieldDto, isArray: true })
  errors!: TenderTypeMasterErrorFieldDto[];
}

export class TenderTypeMasterPayloadDto {
  @ApiProperty({ example: '1' })
  ttmTypeId!: string;

  @ApiProperty()
  ttmTypeName!: string;

  @ApiProperty()
  ttmIsActive!: boolean;

  @ApiProperty()
  ttmIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ttmSyncDate!: string | null;

  @ApiProperty()
  ttmCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ttmCreatedBy!: string | null;

  @ApiProperty()
  ttmModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ttmModifiedBy!: string | null;
}

export class TenderTypeMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class TenderTypeMasterDeleteResultDto {
  @ApiProperty({ example: '1' })
  ttmTypeId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class TenderTypeMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Tender type fetched successfully' })
  message!: string;

  @ApiProperty({ type: TenderTypeMasterPayloadDto })
  data!: TenderTypeMasterPayloadDto;
}

export class TenderTypeMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Tender types fetched successfully' })
  message!: string;

  @ApiProperty({ type: TenderTypeMasterPayloadDto, isArray: true })
  data!: TenderTypeMasterPayloadDto[];

  @ApiProperty({ type: TenderTypeMasterListMetaDto })
  meta!: TenderTypeMasterListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class TenderTypeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Tender type deleted successfully' })
  message!: string;

  @ApiProperty({ type: TenderTypeMasterDeleteResultDto })
  data!: TenderTypeMasterDeleteResultDto;
}
