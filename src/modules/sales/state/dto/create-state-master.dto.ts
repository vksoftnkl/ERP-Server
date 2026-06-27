import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

// Create payload carries only state master fields. `parentId` is NOT part of this DTO — it is a
// separate service argument (the fixed "States" account group id) and cannot come from the client.
export class CreateStateMasterDto {
  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  stmName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  stmAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  stmShort?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  stmOrder?: number = 0;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  stmIsActive?: boolean = true;
}
