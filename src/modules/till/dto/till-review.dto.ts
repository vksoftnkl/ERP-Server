/**
 * Request shapes of head office's reviews (notes 134, Cash Position 289) —
 * TillReviewController's reviews/create (body) and reviews/list (query), served by
 * TillReviewService.
 *
 * Flow: CreateTillReviewDto → TillReviewService.create (assertShape: exactly one of dayId /
 * sessionId, a note unless OK, a journal only on WRITTEN_OFF / SUSPENSE_CLEARED) → one
 * till_session_review row and an HO_REVIEW event → TillReviewCreatePayload;
 * TillReviewListQueryDto → TillReviewService.list → TillReviewListPayload
 * (types/till-api.types.ts).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  NullableString,
  NullableUpperString,
  NullableUuid,
  OptionalUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { REVIEW_REF_OUTCOMES, TillReviewOutcome } from '../types/till-enum';
import { TillScopeDto } from './till-session.dto';

/** POST /till/reviews/create (notes 134 §2.1). */
export class CreateTillReviewDto extends TillScopeDto {
  @ApiProperty({
    example: '2026-2027',
    description: 'The year of the day / session reviewed: the review is filed in it.',
  })
  @UpperMaxString(9)
  accYear!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'A business day of this branch (till_business_day.tbd_id). Exactly one of dayId / sessionId.',
  })
  @NullableUuid()
  dayId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'A till session of this branch (till_session.tss_id). Exactly one of dayId / sessionId.',
  })
  @NullableUuid()
  sessionId?: string | null;

  @ApiProperty({ enum: TillReviewOutcome })
  @IsIn(Object.values(TillReviewOutcome))
  outcome!: TillReviewOutcome;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000,
    description: 'Required unless the outcome is OK (400 TILL_NOTE_REQUIRED).',
  })
  @NullableString(1000)
  note?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: `The journal head office raised — only on ${REVIEW_REF_OUTCOMES.join(' / ')}, with refVoucherAccYear. A posted voucher of this company.`,
  })
  @NullableUuid()
  refVoucherId?: string | null;

  @ApiPropertyOptional({ example: '2026-2027', nullable: true })
  @NullableUpperString(9)
  refVoucherAccYear?: string | null;
}

/** GET /till/reviews/list (notes 134 §2.2). */
export class TillReviewListQueryDto extends TillScopeDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'One business day’s reviews.' })
  @OptionalUuid()
  dayId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'One session’s reviews.' })
  @OptionalUuid()
  sessionId?: string;
}
