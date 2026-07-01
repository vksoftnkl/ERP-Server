import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableDateString, NullableString, RequiredInteger } from 'src/common/dto/dtoDecorators';
export class SaveConfigsDto {
  @ApiProperty({
    description: 'Config identifier (primary key). Updates the record when it already exists.',
  })
  @RequiredInteger(1)
  configId!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Config key/name' })
  @NullableString()
  configName?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Config value' })
  @NullableString()
  configValue?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Last sync timestamp (ISO-8601)' })
  @NullableDateString()
  configSyncDate?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  configCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  configModifiedBy?: string | null;
}