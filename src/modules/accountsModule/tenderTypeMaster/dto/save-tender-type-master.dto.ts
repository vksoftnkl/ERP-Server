import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveTenderTypeMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing tender type',
  })
  @IsOptional()
  @IsUUID('all')
  ttmTypeId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ttmTypeName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ttmIsActive?: boolean;
}
