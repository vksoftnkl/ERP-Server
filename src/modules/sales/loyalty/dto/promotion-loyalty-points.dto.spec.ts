import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListLoyaltyGiftQueryDto } from './list-loyalty-gift-query.dto';
import { ListLoyaltySchemeQueryDto } from './list-loyalty-scheme-query.dto';
import { SaveLoyaltySchemeDto } from './save-loyalty-scheme.dto';

const SCHEME_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';

describe('Promotion Loyalty Points DTOs', () => {
  it('rejects scheme end dates that are before the start date', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      ls_name: 'Summer Rewards',
      ls_type: 'REDEEM',
      ls_start_date: '2026-04-30',
      ls_end_date: '2026-04-01',
      ls_comp_id: COMPANY_ID,
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0].property).toBe('ls_end_date');
  });

  it('parses integer and boolean query values', async () => {
    const dto = plainToInstance(ListLoyaltySchemeQueryDto, {
      ls_comp_id: COMPANY_ID,
      ls_is_active: 'true',
      page: '3',
      limit: '10',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.ls_comp_id).toBe(COMPANY_ID);
    expect(dto.ls_is_active).toBe(true);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
  });

  it('parses required gift list ids as UUID strings', async () => {
    const dto = plainToInstance(ListLoyaltyGiftQueryDto, {
      lsg_ls_id: SCHEME_ID,
      page: '1',
      limit: '20',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.lsg_ls_id).toBe(SCHEME_ID);
  });
});
