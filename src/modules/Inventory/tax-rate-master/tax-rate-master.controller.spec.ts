import { TaxRateMasterController } from './tax-rate-master.controller';
import { TaxRateMasterService } from './tax-rate-master.service';
import { TaxRatePayload, TaxRateResolution } from './types/tax-rate-api.types';

const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46af01';

const PAYLOAD = { tax_id: TAX_ID, tax_name: 'GST 18%', lines: [] } as unknown as TaxRatePayload;
const RESOLUTION: TaxRateResolution = {
  tax_id: TAX_ID,
  tax_name: 'GST 18%',
  supply_nature: null,
  roles: [],
};

describe('TaxRateMasterController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    list: jest.Mock;
    resolveLedgers: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: TaxRateMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue([PAYLOAD]),
      resolveLedgers: jest.fn().mockResolvedValue(RESOLUTION),
      softDelete: jest.fn().mockResolvedValue({ tax_id: TAX_ID, deleted: true, lines_deleted: 2 }),
    };
    controller = new TaxRateMasterController(service as unknown as TaxRateMasterService);
  });

  it('words a body without tax_id as a create', async () => {
    const dto = { tax_name: 'GST 18%' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Tax rate created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a body with tax_id as an update', async () => {
    await expect(controller.save({ tax_id: TAX_ID, tax_rate_perc: 28 })).resolves.toMatchObject({
      message: 'Tax rate updated successfully',
    });
  });

  it('fetches one rate by the tax_id in the query', async () => {
    await expect(controller.getById({ tax_id: TAX_ID })).resolves.toEqual({
      success: true,
      message: 'Tax rate fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(TAX_ID);
  });

  it('lists with the query it was given', async () => {
    const query = { search: '18', active_only: false };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Tax rates fetched successfully',
      data: [PAYLOAD],
    });
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('resolves with the query it was given', async () => {
    const query = { tax_id: TAX_ID, supply_nature: 'INTRA' };

    await expect(controller.resolve(query)).resolves.toEqual({
      success: true,
      message: 'Tax rate ledgers resolved successfully',
      data: RESOLUTION,
    });
    expect(service.resolveLedgers).toHaveBeenCalledWith(query);
  });

  it('deletes as the modifier the query names', async () => {
    await expect(
      controller.remove({ tax_id: TAX_ID, tax_modified_by: 'importer' }),
    ).resolves.toEqual({
      success: true,
      message: 'Tax rate deleted successfully',
      data: { tax_id: TAX_ID, deleted: true, lines_deleted: 2 },
    });
    expect(service.softDelete).toHaveBeenCalledWith(TAX_ID, 'importer');
  });

  it('deletes with no modifier when the query names none', async () => {
    await controller.remove({ tax_id: TAX_ID });

    expect(service.softDelete).toHaveBeenCalledWith(TAX_ID, undefined);
  });
});
