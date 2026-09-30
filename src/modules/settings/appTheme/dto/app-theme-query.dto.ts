import { ApiProperty } from '@nestjs/swagger';
import { RequiredInteger, RequiredUuid } from 'src/common/dto/dtoDecorators';

/** `thmId` of /get, /delete and /restore. */
export class AppThemeIdQueryDto {
  @ApiProperty({ example: 1 })
  @RequiredInteger(1)
  thmId!: number;
}

/** /effective — the company whose theme the client is about to paint. */
export class AppThemeEffectiveQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}
