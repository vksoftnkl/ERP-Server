import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerErrorFieldDto {
  @ApiProperty({ example: 'cusStateCode' })
  field!: string;

  @ApiProperty({ example: 'cusStateCode must be exactly 2 characters' })
  message!: string;
}

export class CustomerErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: CustomerErrorFieldDto, isArray: true })
  errors!: CustomerErrorFieldDto[];
}

export class CustomerPayloadDto {
  @ApiProperty({ format: 'uuid' })
  cusId!: string;

  @ApiPropertyOptional({ maxLength: 5, nullable: true })
  cusTitle!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  cusShort!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  cusCode!: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  cusName!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusAddr1!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusAddr2!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusAddr3!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusCity!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusDistrict!: string | null;

  @ApiProperty({ maxLength: 100 })
  cusStateName!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  cusCountry!: string | null;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  cusStateCode!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  cusLandmark!: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  cusPin!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  cusTel!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  cusPhone1!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  cusPhone2!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  cusWhatsappNo!: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  cusEmail!: string | null;

  @ApiPropertyOptional({ maxLength: 12, nullable: true })
  cusAadharNo!: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  cusContactPerson!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cusDistanceKm!: number | null;

  @ApiProperty()
  cusCreditAllowed!: boolean;

  @ApiProperty()
  cusCreditBillLimit!: number;

  @ApiProperty()
  cusCreditAmtLimit!: number;

  @ApiProperty()
  cusCreditDays!: number;

  @ApiProperty()
  cusDebitBalance!: number;

  @ApiProperty()
  cusDiscPerc!: number;

  @ApiProperty()
  cusDebitGraceDays!: number;

  @ApiProperty()
  cusEnableSms!: boolean;

  @ApiProperty()
  cusOverdueSms!: boolean;

  @ApiProperty()
  cusOverdueBilling!: boolean;

  @ApiProperty()
  cusAllowPromotion!: boolean;

  @ApiProperty()
  cusAllowLoyalty!: boolean;

  @ApiProperty()
  cusAllowDiscount!: boolean;

  @ApiProperty()
  cusSortOrder!: number;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  cusRegionName!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusRegionAddr1!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusRegionAddr2!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusRegionAddr3!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusRegionCity!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusRegionDistrict!: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  cusRegionStateName!: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  cusRegionCountry!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cusBirthDate!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cusMarriageDate!: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  cusTransportName!: string | null;

  @ApiProperty()
  cusFreightCharge!: boolean;

  @ApiProperty()
  cusLoadingCharge!: boolean;

  @ApiProperty()
  cusUnloadingCharge!: boolean;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cusGstNo!: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  cusPanNo!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  cusGstType!: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cusEcommerceGstin!: string | null;

  @ApiProperty()
  cusTcsApplicable!: boolean;

  @ApiProperty()
  cusItcollExempted!: boolean;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  cusItcollType!: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  cusGeoLocation!: string | null;

  @ApiProperty({ type: [Number], example: [] })
  cusCollectionDays!: number[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cusDefaultSalesman!: string | null;

  @ApiProperty()
  cusPriceLevelId!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Retail Price',
    description: 'Name of the linked price level (resolved on the get endpoint)',
  })
  cusPriceLevelName?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cusBilledDate!: string | null;

  @ApiProperty()
  cusBilledCount!: number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  cusNotes!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cusCompanyId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Acme Pvt Ltd',
    description: 'Name of the linked company (resolved on the get endpoint)',
  })
  cusCompanyName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cusBranchId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Branch',
    description: 'Name of the linked branch (resolved on the get endpoint)',
  })
  cusBranchName?: string | null;

  @ApiProperty({ format: 'uuid' })
  cusAreaId!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Downtown',
    description: 'Name of the linked area (resolved on the get endpoint)',
  })
  cusAreaName?: string | null;

  @ApiProperty({ format: 'uuid' })
  cusGroupId!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Wholesale',
    description: 'Name of the linked customer group (resolved on the get endpoint)',
  })
  cusGroupName?: string | null;

  @ApiProperty()
  cusIsActive!: boolean;

  @ApiProperty()
  cusIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  cusSyncDate!: string | null;

  @ApiProperty()
  cusCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  cusCreatedBy!: string | null;

  @ApiProperty()
  cusModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  cusModifiedBy!: string | null;
}

export class CustomerDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  cusId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class CustomerSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Customer fetched successfully' })
  message!: string;

  @ApiProperty({ type: CustomerPayloadDto })
  data!: CustomerPayloadDto;
}

export class CustomerSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Customer deleted successfully' })
  message!: string;

  @ApiProperty({ type: CustomerDeleteResultDto })
  data!: CustomerDeleteResultDto;
}
