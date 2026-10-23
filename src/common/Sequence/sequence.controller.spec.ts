import type { SaveSequenceDto } from './dto/save-sequence.dto';
import { SequenceController } from './sequence.controller';
import type { SequenceService } from './sequence.service';

const SEQ_ID = '019f0000-0000-7000-8000-0000000000a1';

describe('SequenceController', () => {
  const payload = { id: SEQ_ID, lastNo: '42' };
  const meta = { page: 1, limit: 20, total: 1, total_pages: 1 };
  const service = {
    save: jest.fn(async () => payload),
    list: jest.fn(async () => ({ items: [payload], meta })),
    getById: jest.fn(async () => payload),
    softDelete: jest.fn(async () => ({ id: SEQ_ID, deleted: true as const })),
  };
  const controller = new SequenceController(service as unknown as SequenceService);

  it('says "saved" for a new sequence', async () => {
    await expect(controller.save({ vchrTypeId: 3 } as SaveSequenceDto)).resolves.toEqual({
      success: true,
      message: 'Sequence saved successfully',
      data: payload,
    });
  });

  it('says "updated" when the body carries an id', async () => {
    const dto = { id: SEQ_ID, vchrTypeId: 3 } as SaveSequenceDto;

    await expect(controller.save(dto)).resolves.toMatchObject({
      message: 'Sequence updated successfully',
    });
    expect(service.save).toHaveBeenLastCalledWith(dto);
  });

  it('lists with the items as data and the paging as meta', async () => {
    await expect(controller.list({})).resolves.toEqual({
      success: true,
      message: 'Sequences fetched successfully',
      data: [payload],
      meta,
    });
  });

  it('gets one by id', async () => {
    await expect(controller.getById(SEQ_ID)).resolves.toEqual({
      success: true,
      message: 'Sequence fetched successfully',
      data: payload,
    });
    expect(service.getById).toHaveBeenCalledWith(SEQ_ID);
  });

  it('soft-deletes by id', async () => {
    await expect(controller.remove(SEQ_ID)).resolves.toEqual({
      success: true,
      message: 'Sequence deleted successfully',
      data: { id: SEQ_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(SEQ_ID);
  });
});
