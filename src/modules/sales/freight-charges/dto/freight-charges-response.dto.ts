import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as FreightChargesErrorFieldDto };
export { SalesErrorResponseDto as FreightChargesErrorResponseDto };

export class FreightChargesPayloadDto {
  @ApiProperty({ format: 'uuid' })
  frId!: string;

  @ApiPropertyOptional({ nullable: true, example: 0 })
  frFromKm!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 100 })
  frToKm!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 50 })
  frFreightChrg!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  frFromWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 50 })
  frToWeight!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 25 })
  frLoadChrg!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 25 })
  frUnloadChrg!: number | null;

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

export class FreightChargesDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  frId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class FreightChargesSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Freight charges fetched successfully' })
  message!: string;

  @ApiProperty({ type: FreightChargesPayloadDto })
  data!: FreightChargesPayloadDto;
}

export class FreightChargesSuccessCreateDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Freight charges created successfully' })
  message!: string;

  @ApiProperty({ type: FreightChargesPayloadDto })
  data!: FreightChargesPayloadDto;
}

export class FreightChargesSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Freight charges deleted successfully' })
  message!: string;

  @ApiProperty({ type: FreightChargesDeleteResultDto })
  data!: FreightChargesDeleteResultDto;
}
