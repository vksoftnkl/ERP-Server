import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
export class DeleteGodownQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  gdl_id!: string;
}