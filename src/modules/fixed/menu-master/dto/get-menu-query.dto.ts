import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalInteger, OptionalQueryBoolean } from '../../../sales/dto/dtoDecorators';

export class GetMenuQueryDto {
  @ApiPropertyOptional({
    description: 'Fetch a specific menu id. If omitted, menus are returned by parentId.',
    minimum: 0,
    example: 1,
  })
  @OptionalInteger(0)
  menuId?: number;

  @ApiPropertyOptional({
    description: 'Fetch menus under this parent. If omitted, top-level menus are returned.',
    minimum: 0,
    example: 1,
  })
  @OptionalInteger(0)
  parentId?: number;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Include nested child menus recursively',
  })
  @OptionalQueryBoolean()
  includeChildren?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only active menus',
  })
  @OptionalQueryBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only visible menus',
  })
  @OptionalQueryBoolean()
  visibleOnly?: boolean;
}
