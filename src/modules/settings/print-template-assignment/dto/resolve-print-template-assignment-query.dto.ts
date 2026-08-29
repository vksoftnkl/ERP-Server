import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { NullableUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { PTA_OUTPUT_MODES } from '../print-template-assignment.constants';

/// The render path's question: "for this counter, printing this purpose, which
/// design wins?" Narrowest match answers it — counter, then branch, then
/// company, then the every-company row a shipped design may hold.
///
/// All three scope keys are OPTIONAL and default to the SESSION's own — a
/// caller asking "what would I print" should not have to describe itself. The
/// Assignments screen still names them, because its question is the other one:
/// "what would a DIFFERENT counter print", which is the whole point of showing
/// an administrator the effective design per scope.
export class ResolvePrintTemplateAssignmentQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The company printing. Defaults to the session's. Its own rows outrank the every-company rows, which are what it falls back to where it has said nothing.",
  })
  @NullableUuid()
  companyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "Defaults to the session's branch.",
  })
  @NullableUuid()
  branchId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "Defaults to the session's counter.",
  })
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
