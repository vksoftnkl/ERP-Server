import { BatchPrefixController } from './batch-prefix.controller';
import { BatchPrefixService } from './batch-prefix.service';
import { BatchPrefixPayload } from './types/batch-prefix-api.types';

const PREFIX_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const PREFIX = { id: PREFIX_ID, prefixUsed: 'KR' } as BatchPrefixPayload;

describe('BatchPrefixController', () => {
  let service: { save: jest.Mock; list: jest.Mock; getById: jest.Mock; delete: jest.Mock };
  let controller: BatchPrefixController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PREFIX),
      list: jest.fn(),
      getById: jest.fn().mockResolvedValue(PREFIX),
      delete: jest.fn().mockResolvedValue({ id: PREFIX_ID, deleted: true }),
    };
    controller = new BatchPrefixController(service as unknown as BatchPrefixService);
  });

  it.each([
    ['created', { prefixUsed: 'KR' }, 'Batch prefix created successfully'],
    ['updated', { id: PREFIX_ID, prefixUsed: 'KR' }, 'Batch prefix updated successfully'],
  ])('save says %s by whether the body names an id', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: PREFIX });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('list spreads the items into data and the paging into meta', async () => {
    const meta = { page: 1, limit: 20, total: 1, total_pages: 1 };
    service.list.mockResolvedValue({ items: [PREFIX], meta, styles: [] });
    const query = { search: 'kr' };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Batch prefixes fetched successfully',
      data: [PREFIX],
      meta,
    });
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('getById fetches by id and wraps the row', async () => {
    await expect(controller.getById(PREFIX_ID)).resolves.toEqual({
      success: true,
      message: 'Batch prefix fetched successfully',
      data: PREFIX,
    });
    expect(service.getById).toHaveBeenCalledWith(PREFIX_ID);
  });

  it('remove deletes by id and wraps the result', async () => {
    await expect(controller.remove(PREFIX_ID)).resolves.toEqual({
      success: true,
      message: 'Batch prefix deleted successfully',
      data: { id: PREFIX_ID, deleted: true },
    });
    expect(service.delete).toHaveBeenCalledWith(PREFIX_ID);
  });
});
