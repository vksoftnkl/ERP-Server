import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierGroupErrorFieldDto {
  @ApiProperty({ example: 'spgName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate supplier group name is not allowed' })
  message!: string;
}

export class SupplierGroupErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: SupplierGroupErrorFieldDto, isArray: true })
  errors!: SupplierGroupErrorFieldDto[];
}

export class SupplierGroupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  spgId!: string;

  @ApiProperty({ maxLength: 200 })
  spgName!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  spgAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  spgShort!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  spgDesc!: string | null;

  @ApiProperty()
  spgIsActive!: boolean;

  @ApiProperty()
  spgIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  spgSyncDate!: string | null;

  @ApiProperty()
  spgCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  spgCreatedBy!: string | null;

  @ApiProperty()
  spgModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  spgModifiedBy!: string | null;
}

export class SupplierGroupListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class SupplierGroupDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  spgId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class SupplierGroupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Supplier group fetched successfully' })
  message!: string;

  @ApiProperty({ type: SupplierGroupPayloadDto })
  data!: SupplierGroupPayloadDto;
}

export class SupplierGroupSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Supplier groups fetched successfully' })
  message!: string;

  @ApiProperty({ type: SupplierGroupPayloadDto, isArray: true })
  data!: SupplierGroupPayloadDto[];

  @ApiProperty({ type: SupplierGroupListMetaDto })
  meta!: SupplierGroupListMetaDto;
}

export class SupplierGroupSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Supplier group deleted successfully' })
  message!: string;

  @ApiProperty({ type: SupplierGroupDeleteResultDto })
  data!: SupplierGroupDeleteResultDto;
}
