import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString, OptionalBoolean } from 'src/common/dto/dtoDecorators';

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

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description:
      'Blank on create: made from the name (whole name, upper case, letters and digits, at most ' +
      '20; DRIVER2 … when taken). Unique among live designations in any case (409 ' +
      'DESIGNATION_CODE_DUPLICATE). An edit never makes one; blank clears it.',
  })
  @NullableString(50)
  edCode?: string | null;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'IGNORED since HR review step 5 (20/11/2026): Default Designation was removed. Still ' +
      'accepted so an older client is not refused; nothing is written.',
  })
  @OptionalBoolean()
  edIsDefault?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  edRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  edIsActive?: boolean;
}
