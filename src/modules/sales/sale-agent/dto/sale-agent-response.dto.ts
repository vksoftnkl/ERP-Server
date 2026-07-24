import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesErrorFieldDto, SalesErrorResponseDto } from 'src/common/utils/module-response.dto';
export { SalesErrorFieldDto as SaleAgentErrorFieldDto };
export { SalesErrorResponseDto as SaleAgentErrorResponseDto };
export class SaleAgentPayloadDto {
  @ApiProperty({ format: 'uuid' })
  saId!: string;
  @ApiProperty({ format: 'uuid' })
  saCompanyId!: string;
  @ApiPropertyOptional({ nullable: true })
  saCompanyName!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  saBranchId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  saBranchName!: string | null;
  @ApiProperty({ format: 'uuid' })
  saGroupId!: string;
  @ApiPropertyOptional({ nullable: true })
  saGroupName!: string | null;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  saCode!: string | null;
  @ApiProperty({ maxLength: 200 })
  saName!: string;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  saAlias!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  saMobile1!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  saMobile2!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  saAddr1!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  saAddr2!: string | null;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  saCity!: string | null;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  saDistrict!: string | null;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  saState!: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  saPincode!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  saPanNo!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  saGstin!: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  saRemarks!: string | null;
  @ApiProperty()
  saIsActive!: boolean;
  @ApiProperty()
  saIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  saSyncDate!: string | null;
  @ApiProperty()
  saCreatedOn!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  saCreatedBy!: string | null;
  @ApiProperty()
  saModifiedOn!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  saModifiedBy!: string | null;
}
export class SaleAgentDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  saId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class SaleAgentSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Sale agent fetched successfully' })
  message!: string;
  @ApiProperty({ type: SaleAgentPayloadDto })
  data!: SaleAgentPayloadDto;
}
export class SaleAgentSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Sale agent deleted successfully' })
  message!: string;
  @ApiProperty({ type: SaleAgentDeleteResultDto })
  data!: SaleAgentDeleteResultDto;
}