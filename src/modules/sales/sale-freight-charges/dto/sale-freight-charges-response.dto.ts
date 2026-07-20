import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as SaleFreightChargeErrorFieldDto };
export { SalesErrorResponseDto as SaleFreightChargeErrorResponseDto };

export class SaleFreightChargePayloadDto {
  @ApiProperty({ format: 'uuid' })
  frId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  frCompanyId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  frBranchId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 0 })
  frFromKm!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 100 })
  frToKm!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  frFromWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 50 })
  frToWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 250 })
  frFreightChrg!: number | null;

  @ApiProperty({ example: true })
  frIsActive!: boolean;

  @ApiProperty({ example: false })
  frIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  frSyncDate!: string | null;

  @ApiProperty()
  frCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  frCreatedBy!: string | null;

  @ApiProperty()
  frModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  frModifiedBy!: string | null;
}

export class SaleFreightChargeDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  frId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class SaleFreightChargeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale freight charge fetched successfully' })
  message!: string;

  @ApiProperty({ type: SaleFreightChargePayloadDto })
  data!: SaleFreightChargePayloadDto;
}

export class SaleFreightChargeSuccessCreateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale freight charge created successfully' })
  message!: string;

  @ApiProperty({ type: SaleFreightChargePayloadDto })
  data!: SaleFreightChargePayloadDto;
}

export class SaleFreightChargeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale freight charge deleted successfully' })
  message!: string;

  @ApiProperty({ type: SaleFreightChargeDeleteResultDto })
  data!: SaleFreightChargeDeleteResultDto;
}
