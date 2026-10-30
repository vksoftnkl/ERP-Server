import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { IsIn, IsOptional } from 'class-validator';
import { PTA_OUTPUT_MODES } from '../print-template-assignment.constants';

export class SavePrintTemplateAssignmentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, the request updates the existing assignment',
  })
  @OptionalUuid()
  ptaId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'NULL = EVERY COMPANY, the widest rung of the ladder. A global assignment may only name a shipped design. On create the field must be PRESENT — send null deliberately; omitting it is rejected, because "every company" is not something to arrive at by accident.',
  })
  @NullableUuid()
  ptaCompanyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = every branch. Required when ptaDeviceId is given.',
  })
  @NullableUuid()
  ptaBranchId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = every counter. A counter row must also name its branch.',
  })
  @NullableUuid()
  ptaDeviceId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ptaPurposeId!: string;

  /// pta_template_company_key is NOT accepted from the caller. The service
  /// reads the template's owner off the template row and writes it, which is
  /// the only way ck_pta_template_scope can mean anything: a caller free to
  /// state the owner is a caller free to state the wrong one.
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ptaTemplateId!: string;

  @ApiPropertyOptional({ enum: PTA_OUTPUT_MODES, default: 'PRINT' })
  @IsOptional()
  @IsIn(PTA_OUTPUT_MODES)
  ptaOutputMode?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      "A registered printer profile. NULL = the server's default queue for the device. Cannot be combined with ptaPrinterName.",
  })
  @NullableUuid()
  ptaPrinterId?: string | null;

  @ApiPropertyOptional({
    maxLength: 150,
    nullable: true,
    description:
      'A bare queue or share name, for a scope whose printer nobody has registered as a profile. A FALLBACK, never a copy of a profile name — a render through it asserts nothing about paper, codepage or column count. Cannot be combined with ptaPrinterId.',
  })
  @NullableString(150)
  ptaPrinterName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1,
    maximum: 9,
    description: "Overrides the purpose's copy count for this scope. NULL = use it.",
  })
  @IsOptional()
  @OptionalInteger(1, 9)
  ptaCopies?: number | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ptaRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ptaIsActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptaCreatedBy?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptaModifiedBy?: string | null;
}
