import { ApiProperty } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from './configured-grid-style.dto';

export class ConfiguredGridColumnsResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Grid columns fetched successfully' })
  message!: string;

  @ApiProperty({ type: ConfiguredGridStyleDto, isArray: true })
  data!: ConfiguredGridStyleDto[];
}
