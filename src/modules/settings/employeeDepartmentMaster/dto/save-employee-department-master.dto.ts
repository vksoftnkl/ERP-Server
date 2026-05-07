import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString, OptionalBoolean } from '../../dto/dtoDecorators';

export class SaveEmployeeDepartmentMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing employee department',
  })
  @IsOptional()
  @IsUUID('all')
  edptId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  edptName!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  edptCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  edptAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  edptRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  edptIsActive?: boolean;
}
