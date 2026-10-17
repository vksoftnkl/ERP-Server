import { ApiPropertyOptional } from '@nestjs/swagger';
import { NullableString } from 'src/common/dto/dtoDecorators';

/** GET /error-messages (notes 120). */
export class ErrorMessagesQueryDto {
  @ApiPropertyOptional({
    example: 'en',
    nullable: true,
    description: 'Language; else Accept-Language; else en. Only en has rows today.',
  })
  @NullableString(10)
  lang?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-15.1',
    nullable: true,
    description: 'The catalogue version the app holds: the same → `unchanged` and no rows.',
  })
  @NullableString(40)
  since?: string | null;
}
