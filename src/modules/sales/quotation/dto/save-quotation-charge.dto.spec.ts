import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SaveQuotationChargeDto } from './save-quotation-charge.dto';

const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
// resolveActor's fallback (UUID_PATTERN spells it out as an allowed alternative,
// so this one passed under the old @OptionalUuid too — it must keep passing).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (payload: Record<string, unknown>): Promise<SaveQuotationChargeDto> =>
  validationPipe.transform(
    { cdChgId: CHARGE_ID, cdLedgerCode: LEDGER_ID, ...payload },
    {
      type: 'body',
      metatype: SaveQuotationChargeDto,
    },
  ) as Promise<SaveQuotationChargeDto>;

// cd_created_by / cd_modified_by became text columns in migration 20260729121956;
// the actor is an id OR a name, so the uuid pattern no longer applies to them.
describe('SaveQuotationChargeDto — actor columns are free text', () => {
  it('accepts an actor that is not a uuid', async () => {
    const result = await transform({ cdCreatedBy: 'viji karthi', cdModifiedBy: 'admin@erp.local' });

    expect(result.cdCreatedBy).toBe('viji karthi');
    expect(result.cdModifiedBy).toBe('admin@erp.local');
  });

  it('accepts the nil uuid resolveActor falls back to', async () => {
    const result = await transform({ cdCreatedBy: NIL_UUID });

    expect(result.cdCreatedBy).toBe(NIL_UUID);
  });

  it('folds null and the empty string to null, and leaves an omitted actor undefined', async () => {
    const cleared = await transform({ cdCreatedBy: null, cdModifiedBy: '' });
    expect(cleared.cdCreatedBy).toBeNull();
    expect(cleared.cdModifiedBy).toBeNull();

    const omitted = await transform({});
    expect(omitted.cdCreatedBy).toBeUndefined();
    expect(omitted.cdModifiedBy).toBeUndefined();
  });

  it('still rejects a non-string actor', async () => {
    await expect(transform({ cdCreatedBy: { id: 1 } })).rejects.toBeInstanceOf(BadRequestException);
  });
});
