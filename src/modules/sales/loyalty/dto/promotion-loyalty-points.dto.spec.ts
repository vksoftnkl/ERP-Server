import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListLoyaltyGiftQueryDto } from './list-loyalty-gift-query.dto';
import { ListLoyaltySchemeQueryDto } from './list-loyalty-scheme-query.dto';
import { SaveLoyaltySchemeDto } from './save-loyalty-scheme.dto';

describe('Promotion Loyalty Points DTOs', () => {
  it('rejects scheme end dates that are before the start date', async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      ls_name: 'Summer Rewards',
      ls_type: 'GENERAL',
      ls_start_date: '2026-04-30',
      ls_end_date: '2026-04-01',
      ls_comp_id: 1,
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0].property).toBe('ls_end_date');
  });

  it('parses integer and boolean query values', async () => {
    const dto = plainToInstance(ListLoyaltySchemeQueryDto, {
      ls_comp_id: '1',
      ls_branch_id: '2',
      ls_is_active: 'true',
      page: '3',
      limit: '10',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.ls_comp_id).toBe(1);
    expect(dto.ls_branch_id).toBe(2);
    expect(dto.ls_is_active).toBe(true);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
  });

  it('parses required gift list ids as integers', async () => {
    const dto = plainToInstance(ListLoyaltyGiftQueryDto, {
      gift_ls_id: '5',
      page: '1',
      limit: '20',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.gift_ls_id).toBe(5);
  });
});
