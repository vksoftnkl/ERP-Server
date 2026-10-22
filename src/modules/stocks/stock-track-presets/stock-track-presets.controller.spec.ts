import { StockTrackPresetsController } from './stock-track-presets.controller';
import { StockTrackPresetsService } from './stock-track-presets.service';
import { StockTrackPresetsPayload } from './types/stock-track-presets-api.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const SPT_ID = '01000000-0000-7000-8000-0000000000e1';

const PRESET = { spt_id: SPT_ID, spt_code: 'PHARMA' } as StockTrackPresetsPayload;

describe('StockTrackPresetsController', () => {
  let service: { get: jest.Mock };
  let controller: StockTrackPresetsController;

  beforeEach(() => {
    service = {
      get: jest.fn().mockResolvedValue({
        items: [PRESET],
        meta: { company_id: COMPANY_ID, count: 1 },
      }),
    };
    controller = new StockTrackPresetsController(service as unknown as StockTrackPresetsService);
  });

  it('lists the presets as data, with the meta beside them', async () => {
    const query = { company_id: COMPANY_ID };

    await expect(controller.get(query)).resolves.toEqual({
      success: true,
      message: 'Stock track presets fetched successfully',
      data: [PRESET],
      meta: { company_id: COMPANY_ID, count: 1 },
    });
    expect(service.get).toHaveBeenCalledWith(query);
  });

  it('words a fetch by spt_id in the singular', async () => {
    await expect(controller.get({ spt_id: SPT_ID })).resolves.toMatchObject({
      message: 'Stock track preset fetched successfully',
      data: [PRESET],
    });
  });

  it('passes a refusal from the service straight through', async () => {
    const refusal = new Error('not found');
    service.get.mockRejectedValue(refusal);

    await expect(controller.get({ spt_id: SPT_ID })).rejects.toBe(refusal);
  });
});
