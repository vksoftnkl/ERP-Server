import { HsnCodeMasterController } from './hsn-code-master.controller';
import { HsnCodeMasterService } from './hsn-code-master.service';
import { HsnCodeMasterPayload } from './types/hsn-code-master-api.types';

const ITEM = { hsnId: 12, hsnCode: '3004' } as HsnCodeMasterPayload;

describe('HsnCodeMasterController', () => {
  let get: jest.Mock;
  let controller: HsnCodeMasterController;

  beforeEach(() => {
    get = jest.fn().mockResolvedValue({ items: [ITEM], meta: { activeOnly: true, count: 1 } });
    controller = new HsnCodeMasterController({ get } as unknown as HsnCodeMasterService);
  });

  it('words an unfiltered fetch in the plural', async () => {
    await expect(controller.get({})).resolves.toEqual({
      success: true,
      message: 'HSN codes fetched successfully',
      data: [ITEM],
      meta: { activeOnly: true, count: 1 },
    });
  });

  it.each([{ hsnId: 12 }, { hsnCode: '3004' }])(
    'words a fetch by %o in the singular',
    async (query) => {
      await expect(controller.get(query)).resolves.toMatchObject({
        message: 'HSN code fetched successfully',
      });
      expect(get).toHaveBeenCalledWith(query);
    },
  );
});
