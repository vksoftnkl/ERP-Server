import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ItemPriceRefreshQueryDto } from './item-price-refresh-query.dto';
const ITEM_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const IUC_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const transformQuery = (query: Record<string, unknown>) =>
  validationPipe.transform(query, { type: 'query', metatype: ItemPriceRefreshQueryDto });
describe('ItemPriceRefreshQueryDto', () => {
  it('accepts an item and the unit conversion currently on screen', () => {
    const dto = plainToInstance(ItemPriceRefreshQueryDto, {
      item_id: ITEM_ID,
      iuc_id: IUC_ID,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
  it('rejects a missing iuc_id', async () => {
    // The conversion the cycle steps from, so there is nothing to resolve
    // without it.
    await expect(transformQuery({ item_id: ITEM_ID })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a missing item_id', async () => {
    await expect(transformQuery({ iuc_id: IUC_ID })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a non-UUID iuc_id', async () => {
    await expect(transformQuery({ item_id: ITEM_ID, iuc_id: 'not-a-uuid' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects a non-UUID item_id', async () => {
    await expect(transformQuery({ item_id: '42', iuc_id: IUC_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects the lookup parameters it does not take', async () => {
    // The global pipe runs with forbidNonWhitelisted, so a caller reusing the
    // /item-price query string verbatim gets a 400 rather than a silently
    // ignored parameter.
    await expect(
      transformQuery({ item_id: ITEM_ID, iuc_id: IUC_ID, unit_id: IUC_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
