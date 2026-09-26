import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListLoyaltySchemeQueryDto } from './list-loyalty-scheme-query.dto';
import {
  DeleteLoyaltySchemeQueryDto,
  LoyaltySchemeEligibilityQueryDto,
} from './loyalty-scheme-id-query.dto';
import { SaveLoyaltySchemeDto } from './save-loyalty-scheme.dto';

const SCHEME_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';
const CUSTOMER_ID = '01963d86-caf0-7b26-89f0-58ac380a2d64';

describe('Promotion Loyalty Points DTOs', () => {
  it('accepts a minimal create payload', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      lsc_comp_id: COMPANY_ID,
      lsc_code: 'DIWALI25',
      lsc_name: 'Diwali 2025',
      lsc_start_date: '2026-04-01',
      lsc_end_date: '2026-04-30',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  // The identifying fields are required ON CREATE only; an update may send one
  // field. The two DATES are the exception and are NOT caught here: they carry
  // @OptionalDateString, whose @IsOptional short-circuits the @ValidateIf, so a
  // create with no dates reaches the service and parseDateOnly answers the 400.
  // Same arrangement as prm_start_date / prm_end_date on the promotion DTO.
  it('requires the create-only fields when lsc_id is absent', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, { lsc_name: 'Diwali 2025' });

    const properties = (await validate(dto)).map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['lsc_comp_id', 'lsc_code']));
    expect(properties).not.toContain('lsc_start_date');
  });

  it('lets an update send one field and nothing else', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      lsc_id: SCHEME_ID,
      lsc_status: 'SUSPENDED',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  // The five grids ride in the same body, and each row is validated.
  it('validates nested grid rows', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      lsc_id: SCHEME_ID,
      parties: [{ lsp_kind: 'CUSTOMER', lsp_scope_id: 'not-a-uuid' }],
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0].property).toBe('parties');
  });

  it('accepts a whole-bill slab band with no item', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      lsc_id: SCHEME_ID,
      slabs: [{ lss_exceeds: 1000, lss_upto: 4999, lss_each: 100, lss_points: 2 }],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('validates the delete query fields', async () => {
    const dto = plainToInstance(DeleteLoyaltySchemeQueryDto, {
      lsc_id: SCHEME_ID,
      lsc_modified_by: 'counter-1',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lsc_id).toBe(SCHEME_ID);
    expect(dto.lsc_modified_by).toBe('counter-1');
  });

  it('requires both ids on the eligibility query', async () => {
    const dto = plainToInstance(LoyaltySchemeEligibilityQueryDto, { lsc_id: SCHEME_ID });

    expect((await validate(dto)).map((error) => error.property)).toContain('cus_id');
  });

  // The short spellings must survive forbidNonWhitelisted AND reach the
  // canonical field — the @Expose on lsc_comp_id is what makes that work.
  it('resolves the company alias on the list query', async () => {
    const dto = plainToInstance(ListLoyaltySchemeQueryDto, { company: COMPANY_ID });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lsc_comp_id).toBe(COMPANY_ID);
  });

  it('accepts a bare list query', async () => {
    const dto = plainToInstance(ListLoyaltySchemeQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lsc_comp_id).toBeUndefined();
  });

  it('rejects a customer id that is not a uuid', async () => {
    const dto = plainToInstance(LoyaltySchemeEligibilityQueryDto, {
      lsc_id: SCHEME_ID,
      cus_id: CUSTOMER_ID.slice(0, 8),
    });

    expect((await validate(dto)).map((error) => error.property)).toContain('cus_id');
  });
});
