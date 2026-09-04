import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';

export class GetMenuQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Return only visible menus (default: false — returns all menus regardless of visibility)',
  })
  @OptionalQueryBoolean()
  visibleOnly?: boolean;
}
