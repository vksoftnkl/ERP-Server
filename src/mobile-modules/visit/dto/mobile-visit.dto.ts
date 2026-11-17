import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, Max, Min } from 'class-validator';
import {
  NullableNumber,
  NullableStringStrict,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';
import {
  MOBILE_VISIT_REASON_CODES,
  type MobileVisitReasonCode,
} from '../types/mobile-visit-api.types';

/** POST /mobile/visits/create: one check-in. */
export class CreateMobileVisitDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "The phone's own id for this check-in. Sending it again answers the row already saved " +
      '(duplicate: true), never a second one.',
  })
  @RequiredUuid()
  cvClientUuid!: string;

  @ApiProperty({ format: 'uuid', description: 'The company the salesman works for' })
  @RequiredUuid()
  cvCompanyId!: string;

  @ApiProperty({
    maxLength: MOBILE_DEVICE_UID_MAX_LENGTH,
    description:
      "The phone's registered device uid. Its device is cv_device_id, its branch the visit's " +
      "when it belongs to the company (else the company's default branch).",
  })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiProperty({ format: 'uuid', description: 'sales.customers.cus_id' })
  @RequiredUuid()
  cvCustId!: string;

  @ApiProperty({ format: 'uuid', description: 'public.employee_master.emp_id, as soSalesmanId' })
  @RequiredUuid()
  cvSalesmanId!: string;

  @ApiProperty({ enum: MOBILE_VISIT_REASON_CODES })
  @IsIn(MOBILE_VISIT_REASON_CODES)
  cvReasonCode!: MobileVisitReasonCode;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  cvRemarks?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: -90,
    maximum: 90,
    example: 11.1085,
    description: 'Send with cvLongitude, or neither',
  })
  @NullableNumber()
  @Min(-90)
  @Max(90)
  cvLatitude?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: -180, maximum: 180, example: 77.3411 })
  @NullableNumber()
  @Min(-180)
  @Max(180)
  cvLongitude?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, example: 12.5, description: 'Metres' })
  @NullableNumber(0)
  cvGpsAccuracy?: number | null;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    example: '2026-11-16T10:42:00+05:30',
    description: "When the salesman checked in, by the phone's clock (ISO 8601, with an offset)",
  })
  @IsDateString({ strict: true })
  cvVisitAt!: string;
}
