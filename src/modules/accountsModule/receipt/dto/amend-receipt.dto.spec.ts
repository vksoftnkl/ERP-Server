import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AmendReceiptDto } from './amend-receipt.dto';

/**
 * `avhVoucherId` must be REQUIRED on an amend, and it was not.
 *
 * It was declared `declare avhVoucherId: string` — TypeScript's own suggestion
 * for narrowing a base property (TS2612) — and TypeScript emits nothing for a
 * `declare` field, decorators included. So `@ApiProperty` never reached Swagger
 * (the field was absent from `required`) and `@RequiredUuid` never reached the
 * ValidationPipe, and a body with no id reached the raw SQL and returned a 500.
 *
 * The replacement is an initializer, and it has to be a value that is NEITHER
 * null NOR undefined: `SaveReceiptDto` marks the property `@IsOptional()`,
 * class-validator inherits that, and `@IsOptional()` skips every validator on a
 * null or undefined value. `''` is neither, so the rule runs.
 *
 * All four cases are pinned here because three of them pass for the wrong
 * reason under the obvious "fixes".
 */
describe('AmendReceiptDto — avhVoucherId is required', () => {
  const base = {
    avhCompanyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
    avhBranchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
    avhAccYear: '2026-2027',
    avhVoucherDate: '2026-09-18',
    avhPartyId: '01a0aa0b-31c3-7602-9209-8cf164d4b6c8',
    tenders: [],
    allocations: [],
    onAccount: 0,
    baseRevision: 0,
    editRemark: 'a reason',
  };

  const failingProperties = (payload: Record<string, unknown>): string[] =>
    validateSync(plainToInstance(AmendReceiptDto, payload), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).map((error) => error.property);

  it('refuses a body with no avhVoucherId', () => {
    expect(failingProperties(base)).toContain('avhVoucherId');
  });

  // This one already held before the fix — the base's own `Transform` turns a
  // null into something that fails the uuid pattern, so it never reached the
  // inherited `@IsOptional()`. Kept because the rule matters, not because it
  // discriminates: the case that actually broke is the one above.
  it('refuses an explicit null', () => {
    expect(failingProperties({ ...base, avhVoucherId: null })).toContain('avhVoucherId');
  });

  it('refuses something that is not a uuid', () => {
    expect(failingProperties({ ...base, avhVoucherId: 'rct00111' })).toContain('avhVoucherId');
  });

  it('accepts a real id', () => {
    expect(
      failingProperties({ ...base, avhVoucherId: '01a0b35a-2f71-767f-a31d-5a9e6cf9ac99' }),
    ).not.toContain('avhVoucherId');
  });

  it('exposes avhVoucherId to Swagger as required', () => {
    // The decorator metadata @nestjs/swagger reads. A `declare` field carries
    // none of this, which is how the field went missing from `required`.
    const metadata = Reflect.getMetadata(
      'swagger/apiModelProperties',
      AmendReceiptDto.prototype,
      'avhVoucherId',
    ) as { required?: boolean } | undefined;

    expect(metadata).toBeDefined();
    expect(metadata?.required).not.toBe(false);
  });
});
