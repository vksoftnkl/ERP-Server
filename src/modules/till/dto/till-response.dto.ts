/**
 * Swagger-only shapes: the envelope every /till/* route answers with and the error body
 * TillExceptionFilter sends. Nothing here is validated or instantiated — the controllers name
 * these classes in @ApiOkResponse / @ApiConflictResponse … so the OpenAPI document shows the
 * house shape; the real `data` is typed by the payload interfaces of types/till-api.types.ts.
 *
 * TillSuccessDto wraps one object, TillListSuccessDto a list (denominations/list);
 * TillErrorResponseDto carries TillErrorDetailDto rows — the one throwTill builds
 * (till-errors.ts), with the extras a 428 TILL_APPROVAL_REQUIRED adds. TillApprovalNeedDto is
 * the `approval` a payment's response DTO shows (accountsModule/payment/dto/payment-response.dto.ts).
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger shapes for /till/*. `data` is described by the payload interfaces in
 * types/till-api.types.ts; these classes carry the envelope and the error body
 * (`errors[].code` is the TILL_* code §7.3 lists, with its status).
 */
export class TillErrorDetailDto {
  @ApiProperty({ example: 'tssId' })
  field!: string;

  @ApiProperty({ example: 'Session C01-261008-01 is COUNTING; this needs OPEN' })
  message!: string;

  @ApiPropertyOptional({ example: 'TILL_SESSION_NOT_OPEN' })
  code?: string;

  @ApiPropertyOptional({
    example: 'CASH_VARIANCE',
    description: 'TILL_APPROVAL_REQUIRED: the event.',
  })
  event?: string;

  @ApiPropertyOptional({
    example: 80,
    description: 'TILL_APPROVAL_REQUIRED: the amount it is for.',
  })
  amount?: number;

  @ApiPropertyOptional({
    example: 'SUPERVISOR',
    description: 'TILL_APPROVAL_REQUIRED: the lowest level that may approve.',
  })
  requiredRole?: string;
}

/** The house error body: `success` false, a message, and the field errors. */
export class TillErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: () => TillErrorDetailDto, isArray: true })
  errors!: TillErrorDetailDto[];
}

/** `{ success: true, message, data }` — one object in `data`. */
export class TillSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;
}

/** The same envelope with a list in `data` (GET denominations/list). */
export class TillListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  data!: Record<string, unknown>[];
}

/** TillApprovalNeed — what an approval rule would ask of a payment or an expense (reported, phase 3 enforces). */
export class TillApprovalNeedDto {
  @ApiProperty({ example: 'CASH_PAYMENT' })
  event!: string;

  @ApiProperty({ format: 'uuid' })
  ruleId!: string;

  @ApiProperty({ example: 'OVER_AMOUNT', description: 'ALWAYS | OVER_AMOUNT' })
  mode!: string;

  @ApiProperty({ example: 1000 })
  threshold!: number;

  @ApiProperty({
    example: 1500,
    description: 'What was judged: a payment’s cash part, an expense’s total.',
  })
  amount!: number;

  @ApiProperty({ example: 'SUPERVISOR' })
  minRole!: string;

  @ApiProperty({ example: 'COUNTER', description: 'COUNTER | REMOTE | EITHER' })
  channel!: string;

  @ApiProperty({ example: false })
  twoPerson!: boolean;

  @ApiProperty({ example: true })
  blocksTill!: boolean;

  @ApiProperty({
    example: false,
    description: 'false until phase 3 builds the gate: the document posts, the need is recorded.',
  })
  enforced!: false;
}
