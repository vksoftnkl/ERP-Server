import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as AreaErrorFieldDto };
export { SalesErrorResponseDto as AreaErrorResponseDto };

export class AreaPayloadDto {
  @ApiProperty({ format: 'uuid' })
  armId!: string;
  @ApiProperty({ maxLength: 150 })
  armName!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  armAlias!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  armShort!: string | null;
  @ApiProperty({ format: 'uuid' })
  armCityId!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Coimbatore',
    description: 'Name of the linked city (resolved on the get endpoint)',
  })
  armCityName?: string | null;
  @ApiProperty({ example: 0 })
  armSort!: number;
  @ApiPropertyOptional({ nullable: true, example: 10 })
  armDistanceKm!: number | null;
  @ApiProperty({ type: [Number], example: [] })
  armCollectionDays!: number[];
  @ApiProperty({ example: true })
  armIsActive!: boolean;
  @ApiProperty({ example: false })
  armIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  armSyncDate!: string | null;
  @ApiProperty()
  armCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  armCreatedBy!: string | null;
  @ApiProperty()
  armModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  armModifiedBy!: string | null;
}

export class AreaDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  armId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class AreaSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Area fetched successfully' })
  message!: string;
  @ApiProperty({ type: AreaPayloadDto })
  data!: AreaPayloadDto;
}

export class AreaSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Area deleted successfully' })
  message!: string;
  @ApiProperty({ type: AreaDeleteResultDto })
  data!: AreaDeleteResultDto;
}

export class AreaMasterCreateResultDto {
  @ApiProperty({ type: AreaPayloadDto })
  areaMaster!: AreaPayloadDto;
  @ApiProperty({ format: 'uuid', description: 'Linked account group id (equals armId)' })
  accGroupId!: string;
}

export class AreaMasterCreateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Area created successfully' })
  message!: string;
  @ApiProperty({ type: AreaMasterCreateResultDto })
  data!: AreaMasterCreateResultDto;
}
