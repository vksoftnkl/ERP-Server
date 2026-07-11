import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BarcodeLookupQueryDto {
  @ApiProperty({
    example: '8901234567890',
    maxLength: 64,
    description:
      'Barcode / EAN code to resolve (legacy iflag=10). Matched case-insensitively against item_ean_codes.ean_code.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  barcode!: string;
}
