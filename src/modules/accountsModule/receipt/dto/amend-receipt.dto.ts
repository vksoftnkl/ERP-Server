import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import {
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { SaveReceiptDto } from './save-receipt.dto';
import {
  PostReceiptAllocationDto,
  PostReceiptCreditDto,
  PostReceiptOtherLinePinDto,
} from './post-receipt.dto';

/**
 * R20 — `POST /receipts/amend`, editing a POSTED receipt WHOLE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THE FULL PAYLOAD, AND NOT FIELD-BY-FIELD ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The first shape proposed was a tier of small routes — one for header text,
 * one for instrument detail. It was rejected, correctly: **the operator does
 * not think in tiers.** They think "this receipt is wrong, here it is again,
 * right this time." A route per field also multiplies the number of places the
 * posting rules have to be re-implemented, and each one drifts.
 *
 * So this is EXACTLY what `/create` and `/post` take together — the same
 * object the screen already assembles, which is why the client needs no new
 * payload code and no new dialog — plus the keys of the posted receipt, a
 * `baseRevision` and an `editRemark`.
 *
 * It extends `SaveReceiptDto` (the `/create` half) and re-declares the
 * `/post` half's four fields, because TypeScript has no multiple inheritance
 * and duplicating the four is cheaper than a mixin nobody would read. The
 * nested classes are the POST ones themselves, not copies, so a rule added to
 * an allocation reaches this route with no edit here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS IS ITS OWN ROUTE, AND NOT A MODE ON /create
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Asked and settled the same day, because it is the obvious first thought:
 * `/receipts/create` is already an upsert on `avhVoucherId`, so why not let a
 * POSTED id mean "amend"?
 *
 * **Because `/create` is the route the screen calls on every draft save** —
 * every save, every retry after a timeout, every double-submit. Today a POSTED
 * voucher there is a harmless 409. Make POSTED mean "amend" and every one of
 * those becomes a silent restatement of a posted document that nobody asked to
 * change. That 409 stays exactly as it is.
 *
 * There is also an asymmetry that does not go away: the normal flow is
 * `/create` then `/post`, two calls. An amend is inherently ONE call that does
 * both. Folding it in would make `/create` sometimes write ledger legs and
 * sometimes not, decided by a status the caller may not know it has.
 *
 * A middle option was considered — one URL with an explicit `mode: "AMEND"`
 * rather than an inferred status — and it is sound; it was not taken for one
 * practical reason. **Amend is the only route in this module gated by a
 * company setting.** A route that can be switched off is easier to reason
 * about than a mode flag inside a DTO every client already sends and that must
 * be checked against a setting on every request.
 */
export class AmendReceiptDto extends SaveReceiptDto {
  /**
   * REQUIRED here, where `SaveReceiptDto` leaves it optional.
   *
   * `/create` may be handed no id — that is how a new draft is born. An amend
   * always names an existing POSTED receipt, so an absent id is not "make me a
   * new one", it is a malformed request.
   *
   * ═══════════════════════════════════════════════════════════════════════
   *  THE `= ''` IS LOAD-BEARING. DO NOT "TIDY" IT.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * This was written `declare avhVoucherId: string` — which is what TypeScript
   * itself suggests for a narrowed base property (TS2612), and which silently
   * broke both halves of the rule. **TypeScript emits nothing at all for a
   * `declare` field, decorators included**, so neither `@ApiProperty` nor
   * `@RequiredUuid` ever reached the metadata: the field was missing from
   * Swagger's `required` list, the ValidationPipe had no rule to apply, and a
   * body with no `avhVoucherId` sailed through to the raw SQL below and came
   * back as a 500 instead of a 400.
   *
   * An initializer is the only other thing TS2612 accepts — and it has to be a
   * value that is NOT null or undefined, which is the part that is easy to get
   * wrong. `SaveReceiptDto` marks this property `@IsOptional()`, class-validator
   * inherits that from the base class, and `@IsOptional()` means "skip EVERY
   * validator on this property when the value is null or undefined". So
   * `= undefined!` would reinstate exactly the bug it is meant to fix.
   *
   * `''` is neither, so the inherited skip does not fire and `@RequiredUuid`
   * runs and rejects it. Checked on all four cases — absent, explicit null,
   * a non-uuid string, and a real id — in `amend-receipt.dto.spec.ts`, which
   * exists to keep this from regressing.
   */
  @ApiProperty({
    format: 'uuid',
    // Stated, not inferred. The Swagger CLI plugin reads the AST and treats a
    // property with an initializer as optional — so the `= ''` that makes the
    // VALIDATOR fire would, on its own, leave the field out of `required` all
    // over again. The two halves of this bug have opposite causes and both
    // need saying out loud.
    required: true,
    description: 'The POSTED receipt being restated. Its id, number and refno all survive.',
  })
  @RequiredUuid()
  avhVoucherId: string = '';

  // ── The /post half ────────────────────────────────────────────────────────

  @ApiProperty({
    type: () => PostReceiptAllocationDto,
    isArray: true,
    description:
      'IN ORDER, exactly as /post takes them — and, exactly as at /post, a PREVIEW. The server ' +
      're-reads every bill under a row lock AFTER the unwind has reopened them, re-runs the ' +
      'allocation engine and refuses a mismatch.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations!: PostReceiptAllocationDto[];

  @ApiPropertyOptional({ type: () => PostReceiptCreditDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptCreditDto)
  creditsApplied: PostReceiptCreditDto[] = [];

  @ApiPropertyOptional({ type: () => PostReceiptOtherLinePinDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptOtherLinePinDto)
  otherLineBills: PostReceiptOtherLinePinDto[] = [];

  @ApiProperty({
    example: 14450,
    minimum: 0,
    description:
      'What is left over and will be held as an ADVANCE bill. Recomputed server-side against ' +
      'the REOPENED bills and refused if it disagrees.',
  })
  @RequiredNumber(0)
  onAccount!: number;

  // ── What only an amend carries ────────────────────────────────────────────

  /**
   * The revision the client LOADED — the `avhRevisionNo` that came back on
   * `/receipts/get`. It must equal the header's current value or the amend is
   * refused with a 409 naming what it now is.
   *
   * **It is the optimistic lock, and it is not optional.** Two people have
   * rct00015 open. A amends the cheque number and saves. B, who loaded it
   * before that, amends the party's name and saves. Without the check B's
   * payload is the whole receipt, so it silently puts the wrong cheque number
   * back — and the audit log faithfully records that B did it on purpose.
   *
   * A last-writer-wins race is survivable on a master record. On a posted
   * voucher it rewrites ledger legs, so it is not.
   *
   * The client holds the value it loaded and sends it straight back. It never
   * computes or increments it, and on the 409 it RELOADS rather than retrying
   * with the new number — which would defeat the whole point of the lock.
   */
  @ApiProperty({
    example: 1,
    minimum: 0,
    description:
      'The avhRevisionNo /receipts/get returned when this receipt was loaded. Refused with a ' +
      '409 if it is no longer current: somebody amended the receipt in between, and an amend ' +
      'carries the whole document, so proceeding would silently undo their correction.',
  })
  @RequiredInteger(0)
  baseRevision!: number;

  /**
   * Why. Required for the same reason `/update-header`'s is: the trail has to
   * say **why**, and nobody writes it afterwards.
   */
  @ApiProperty({
    maxLength: 250,
    example: 'cheque no keyed 55491, actual 55419',
    description:
      'Why the receipt is being restated. Goes on the txn_status_log step and on every ' +
      'audit.audit_log row the amend writes.',
  })
  @UpperMaxString(250)
  editRemark!: string;
}
