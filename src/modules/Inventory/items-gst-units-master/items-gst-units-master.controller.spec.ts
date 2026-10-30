import { ItemsGstUnitsMasterController } from './items-gst-units-master.controller';
import { ItemsGstUnitsMasterService } from './items-gst-units-master.service';
import { ItemGstUnitPayload } from './types/item-gst-unit-api.types';

const UNIT = {
  item_gst_unit_id: 1,
  item_gst_unit_code: 'NOS',
  item_gst_unit_name: 'Numbers',
} as ItemGstUnitPayload;

describe('ItemsGstUnitsMasterController', () => {
  let service: { list: jest.Mock };
  let controller: ItemsGstUnitsMasterController;

  beforeEach(() => {
    service = { list: jest.fn().mockResolvedValue([UNIT]) };
    controller = new ItemsGstUnitsMasterController(
      service as unknown as ItemsGstUnitsMasterService,
    );
  });

  it('passes the query to the service and wraps the units', async () => {
    const query = { search: 'num' };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item GST units fetched successfully',
      data: [UNIT],
    });
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('wraps an empty list the same way', async () => {
    service.list.mockResolvedValue([]);

    await expect(controller.list({})).resolves.toEqual({
      success: true,
      message: 'Item GST units fetched successfully',
      data: [],
    });
  });
});
