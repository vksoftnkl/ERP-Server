import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableUuid, OptionalQueryBoolean, RequiredUuid } from 'src/common/dto/dtoDecorators';

export class PrintTemplateIdQueryDto {
  @ApiProperty({ format: 'uuid', example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  ptlId!: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Include revisions that were soft deleted. Off by default; the append-only history is ' +
      'still there when an audit needs it.',
  })
  @OptionalQueryBoolean()
  includeDeletedVersions?: boolean;
}

export class DeletePrintTemplateQueryDto {
  @ApiProperty({ format: 'uuid', example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  ptlId!: string;

  // `type: String` is load-bearing, not decoration: the property is declared
  // `string | null`, so design:type reflects as Object and Swagger emits a $ref
  // to a junk "Object" schema for the query parameter instead of a string.
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Stamped onto ptl_modified_by; falls back to the authenticated user',
  })
  @NullableUuid()
  ptlModifiedBy?: string | null;
}
