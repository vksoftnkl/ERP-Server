import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvtDrcrType, AvtTallyReservedVch } from '@prisma/client';

export class AccountVoucherTypeErrorFieldDto {
  @ApiProperty({ example: 'avtShort' })
  field!: string;

  @ApiProperty({ example: 'Duplicate avtShort is not allowed' })
  message!: string;
}

export class AccountVoucherTypeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: AccountVoucherTypeErrorFieldDto, isArray: true })
  errors!: AccountVoucherTypeErrorFieldDto[];
}

export class AccountVoucherTypePayloadDto {
  @ApiProperty({ format: 'uuid' })
  avtId!: string;

  @ApiProperty({ maxLength: 30 })
  avtShort!: string;

  @ApiProperty({ maxLength: 150 })
  avtDesc!: string;

  @ApiProperty({ enum: AvtDrcrType, enumName: 'AvtDrcrType' })
  avtDrcr!: AvtDrcrType;

  @ApiProperty({ example: true })
  avtPrintEnabled!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  avtPrintStyle!: string | null;

  @ApiProperty({ example: 0 })
  avtSortOrder!: number;

  @ApiProperty({ maxLength: 150 })
  avtTallyName!: string;

  @ApiPropertyOptional({
    enum: AvtTallyReservedVch,
    enumName: 'AvtTallyReservedVch',
    nullable: true,
  })
  avtTallyReservedType!: AvtTallyReservedVch | null;

  @ApiProperty({ example: true })
  avtIsActive!: boolean;

  @ApiProperty({ example: false })
  avtIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  avtSyncDate!: string | null;

  @ApiProperty()
  avtCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  avtCreatedBy!: string | null;

  @ApiProperty()
  avtModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  avtModifiedBy!: string | null;
}

export class AccountVoucherTypeListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class AccountVoucherTypeDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  avtId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class AccountVoucherTypeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account voucher type fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountVoucherTypePayloadDto })
  data!: AccountVoucherTypePayloadDto;
}

export class AccountVoucherTypeSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account voucher types fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountVoucherTypePayloadDto, isArray: true })
  data!: AccountVoucherTypePayloadDto[];

  @ApiProperty({ type: AccountVoucherTypeListMetaDto })
  meta!: AccountVoucherTypeListMetaDto;
}

export class AccountVoucherTypeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account voucher type deleted successfully' })
  message!: string;

  @ApiProperty({ type: AccountVoucherTypeDeleteResultDto })
  data!: AccountVoucherTypeDeleteResultDto;
}
