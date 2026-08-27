import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { NullableUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { PTA_OUTPUT_MODES } from '../print-template-assignment.constants';

/// The render path's question: "for this counter, printing this purpose, which
/// design wins?" Narrowest match answers it — counter, then branch, then
/// company, then the every-company row a shipped design may hold.
export class ResolvePrintTemplateAssignmentQueryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The company printing. Its own rows outrank the every-company rows, which are what it falls back to where it has said nothing.',
  })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  branchId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  deviceId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  purposeId!: string;

  @ApiPropertyOptional({ enum: PTA_OUTPUT_MODES, default: 'PRINT' })
  @IsOptional()
  @IsIn(PTA_OUTPUT_MODES)
  outputMode?: string;
}
