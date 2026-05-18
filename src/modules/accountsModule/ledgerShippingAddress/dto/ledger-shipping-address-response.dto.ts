import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import { AccountsListMetaDto } from 'src/common/utils/module-response.dto';

export class LedgerShippingAddressErrorFieldDto {
  @ApiProperty({ example: 'saaLedgerId' })
  field!: string;

  @ApiProperty({ example: 'No active ledger found with id 0195b8ff-7b6e-7dbf-9d3a-cab4e4504b59' })
  message!: string;
}

export class LedgerShippingAddressErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: LedgerShippingAddressErrorFieldDto, isArray: true })
  errors!: LedgerShippingAddressErrorFieldDto[];
}

export class LedgerShippingAddressPayloadDto {
  @ApiProperty({ format: 'uuid' })
  saaId!: string;

  @ApiPropertyOptional({ nullable: true })
  saaCompanyId!: string | null;

  @ApiProperty({ format: 'uuid' })
  saaLedgerId!: string;

  @ApiProperty()
  saaAddrType!: string;

  @ApiProperty()
  saaIsDefault!: boolean;

  @ApiProperty()
  saaSort!: number;

  @ApiPropertyOptional({ nullable: true })
  saaTrdnm!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaContactName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaLoc!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaPin!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaStateCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaStateName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaDistanceKm!: number | null;

  @ApiPropertyOptional({ nullable: true })
  saaPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaGstin!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaPan!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaSyncDate!: string | null;

  @ApiProperty()
  saaIsActive!: boolean;

  @ApiProperty()
  saaIsDeleted!: boolean;

  @ApiProperty()
  saaCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  saaCreatedBy!: string | null;

  @ApiProperty()
  saaModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  saaModifiedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  saaRemarks!: string | null;
}

export class LedgerShippingAddressDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  saaId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LedgerShippingAddressSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger shipping address fetched successfully' })
  message!: string;

  @ApiProperty({ type: LedgerShippingAddressPayloadDto })
  data!: LedgerShippingAddressPayloadDto;
}

export class LedgerShippingAddressSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger shipping addresses fetched successfully' })
  message!: string;

  @ApiProperty({ type: LedgerShippingAddressPayloadDto, isArray: true })
  data!: LedgerShippingAddressPayloadDto[];

  @ApiProperty({ type: AccountsListMetaDto })
  meta!: AccountsListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class LedgerShippingAddressSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger shipping address deleted successfully' })
  message!: string;

  @ApiProperty({ type: LedgerShippingAddressDeleteResultDto })
  data!: LedgerShippingAddressDeleteResultDto;
}
