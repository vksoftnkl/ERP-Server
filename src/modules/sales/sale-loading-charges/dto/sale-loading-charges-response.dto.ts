import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as SaleLoadingChargeErrorFieldDto };
export { SalesErrorResponseDto as SaleLoadingChargeErrorResponseDto };

export class SaleLoadingChargePayloadDto {
  @ApiProperty({ format: 'uuid' })
  ilcId!: string;

  @ApiPropertyOptional({ nullable: true, example: 0 })
  ilcFromWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 50 })
  ilcToWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 25 })
  ilcLoadChrg!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 25 })
  ilcUnloadChrg!: number | null;

  @ApiProperty({ example: true })
  ilcIsActive!: boolean;

  @ApiProperty({ example: false })
  ilcIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ilcSyncDate!: string | null;

  @ApiProperty()
  ilcCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ilcCreatedBy!: string | null;

  @ApiProperty()
  ilcModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ilcModifiedBy!: string | null;
}

export class SaleLoadingChargeDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ilcId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class SaleLoadingChargeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale loading charge fetched successfully' })
  message!: string;

  @ApiProperty({ type: SaleLoadingChargePayloadDto })
  data!: SaleLoadingChargePayloadDto;
}

export class SaleLoadingChargeSuccessCreateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale loading charge created successfully' })
  message!: string;

  @ApiProperty({ type: SaleLoadingChargePayloadDto })
  data!: SaleLoadingChargePayloadDto;
}

export class SaleLoadingChargeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sale loading charge deleted successfully' })
  message!: string;

  @ApiProperty({ type: SaleLoadingChargeDeleteResultDto })
  data!: SaleLoadingChargeDeleteResultDto;
}
