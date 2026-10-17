import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class GstinLookupQueryDto {
  @ApiProperty({ example: '33ABNPL5414F1ZU', description: 'The GSTIN to look up (15 characters).' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[0-9A-Z]{15}$/, { message: 'gstin must be exactly 15 letters or digits' })
  gstin!: string;
}
