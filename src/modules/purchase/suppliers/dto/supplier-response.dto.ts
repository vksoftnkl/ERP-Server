import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierErrorFieldDto {
  @ApiProperty({ example: 'supName' })
  field!: string;
  @ApiProperty({ example: 'Duplicate supplier name is not allowed for this company' })
  message!: string;
}
export class SupplierErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: SupplierErrorFieldDto, isArray: true })
  errors!: SupplierErrorFieldDto[];
}
export class SupplierPayloadDto {
  @ApiProperty({ format: 'uuid' })
  supId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supCompanyId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Acme Pvt Ltd',
    description: 'Name of the linked company (resolved on the get endpoint)',
  })
  supCompanyName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supBranchId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Branch',
    description: 'Name of the linked branch (resolved on the get endpoint)',
  })
  supBranchName?: string | null;
  @ApiProperty({ format: 'uuid' })
  supGroupId!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Wholesale Suppliers',
    description: 'Name of the linked supplier group (resolved on the get endpoint)',
  })
  supGroupName?: string | null;
  @ApiProperty()
  supPurchaseType!: string;
  @ApiProperty({ maxLength: 200 })
  supName!: string;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  supShort!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supAddr1!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supAddr2!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supAddr3!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supCity!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supDistrict!: string | null;
  @ApiProperty({ maxLength: 100 })
  supStateName!: string;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  supCountry!: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  supPincode!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  supTel!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  supPhone!: string | null;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  supMailId!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  supWhatsappNo!: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  supWebsiteAddress!: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  supChequePreName!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supNotes!: string | null;
  @ApiProperty()
  supCreditDays!: number;
  @ApiProperty()
  supCashDiscPerc!: number;
  @ApiProperty({ type: [Number], example: [] })
  supCollectionDays!: number[];
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  supGstNo!: string | null;
  @ApiProperty({ minLength: 2, maxLength: 2 })
  supStateCode!: string;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  supPanNo!: string | null;
  @ApiProperty({ maxLength: 30 })
  supGstType!: string;
  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  supSupCst!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  supDrugLiscenceNo!: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  supRegionName!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supRegionAddr1!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supRegionAddr2!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supRegionAddr3!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supRegionCity!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  supRegionDistrict!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  supRegionStateName!: string | null;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  supRegionCountry!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  supBilledDate!: string | null;
  @ApiPropertyOptional({ nullable: true })
  supSortOrder!: number | null;
  @ApiProperty()
  supIsActive!: boolean;
  @ApiProperty()
  supIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  supSyncDate!: string | null;
  @ApiProperty()
  supCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  supCreatedBy!: string | null;
  @ApiProperty()
  supModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  supModifiedBy!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supStateId!: string | null;
}
export class SupplierDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  supId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class SupplierSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Supplier fetched successfully' })
  message!: string;
  @ApiProperty({ type: SupplierPayloadDto })
  data!: SupplierPayloadDto;
}
export class SupplierSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Supplier deleted successfully' })
  message!: string;
  @ApiProperty({ type: SupplierDeleteResultDto })
  data!: SupplierDeleteResultDto;
}