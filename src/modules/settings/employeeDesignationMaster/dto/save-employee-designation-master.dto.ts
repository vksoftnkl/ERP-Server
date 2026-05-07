import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString, OptionalBoolean } from '../../dto/dtoDecorators';

export class SaveEmployeeDesignationMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing employee designation',
  })
  @IsOptional()
  @IsUUID('all')
  edId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  edName!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  edCode?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  edIsDefault?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  edRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  edIsActive?: boolean;
}
