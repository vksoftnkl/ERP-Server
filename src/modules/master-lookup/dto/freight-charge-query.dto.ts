import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
export class FreightChargeQueryDto {
  @ApiProperty({
    type: Number,
    minimum: 0,
    example: 45,
    description: 'Distance in km (legacy iflag=9). Returns freight slabs where distance is between fr_from_km and fr_to_km.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  distance!: number;
}