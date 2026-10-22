import { HttpException } from '@nestjs/common';
import { SaveItemQtyPriceDto } from './dto/save-item-qty-price.dto';
import { ItemsQtyPriceMasterController } from './items-qty-price-master.controller';
import { ItemsQtyPriceMasterService } from './items-qty-price-master.service';
import { ItemQtyPricePayload } from './types/item-qty-price-api.types';
import { ItemQtyPriceErrorCode } from './types/item-qty-price-error-codes';

const IQP_ID = '019c6f6c-be87-7a11-8905-36092c46aa01';
const OTHER_IQP_ID = '019c6f6c-be87-7a11-8905-36092c46aa09';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46aa02';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46aa03';

const PAYLOAD = { iqp_id: IQP_ID, iqp_item_id: ITEM_ID } as ItemQtyPricePayload;
const SLAB = { iqp_item_id: ITEM_ID, iqp_item_unit_id: UNIT_ID, iqp_effective_from: '2026-04-01' };

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

describe('ItemsQtyPriceMasterController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    list: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
  };
  let controller: ItemsQtyPriceMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue([PAYLOAD]),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({
        items: [PAYLOAD],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      }),
      softDelete: jest.fn(async (ids: string | string[]) =>
        Array.isArray(ids)
          ? ids.map((iqp_id) => ({ iqp_id, deleted: true }))
          : { iqp_id: ids, deleted: true },
      ),
      restore: jest.fn(async (ids: string | string[]) =>
        Array.isArray(ids)
          ? ids.map((iqp_id) => ({ iqp_id, deleted: false }))
          : { iqp_id: ids, deleted: false },
      ),
    };
    controller = new ItemsQtyPriceMasterController(
      service as unknown as ItemsQtyPriceMasterService,
    );
  });

  // ── POST create ───────────────────────────────────────────────────────────
  describe('save', () => {
    it('validates the array into DTOs and wraps what the service saved', async () => {
      await expect(controller.save([{ ...SLAB, iqp_price_mode: 'f' }])).resolves.toEqual({
        success: true,
        message: 'Item qty prices saved successfully',
        data: [PAYLOAD],
      });

      const [sent] = service.save.mock.calls[0] as [SaveItemQtyPriceDto[]];
      expect(sent).toHaveLength(1);
      expect(sent[0]).toBeInstanceOf(SaveItemQtyPriceDto);
      expect(sent[0]).toMatchObject({ ...SLAB, iqp_price_mode: 'F' });
    });

    it('refuses a body that is not an array', async () => {
      const refusal = await refusalOf(controller.save(SLAB));

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Validation failed',
          errors: [
            {
              field: 'request',
              code: ItemQtyPriceErrorCode.PAYLOAD_NOT_ARRAY,
              message: 'Request payload must be an array of item qty prices',
            },
          ],
        },
      });
      expect(service.save).not.toHaveBeenCalled();
    });

    it.each([
      ['a slab without its item', { iqp_item_unit_id: UNIT_ID, iqp_effective_from: '2026-04-01' }],
      ['a price mode outside P, R, F', { ...SLAB, iqp_price_mode: 'X' }],
      ['a negative lower bound', { ...SLAB, iqp_from_qty: -1 }],
      ['an effective-from that is not a date string', { ...SLAB, iqp_effective_from: 'soon' }],
    ])('refuses %s before the service is called', async (_label, slab) => {
      const refusal = await refusalOf(controller.save([slab]));

      expect(refusal.status).toBe(400);
      expect(service.save).not.toHaveBeenCalled();
    });
  });

  // ── GET get ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('answers one slab when iqp_id is sent', async () => {
      await expect(controller.getById({ iqp_id: IQP_ID })).resolves.toEqual({
        success: true,
        message: 'Item qty price fetched successfully',
        data: PAYLOAD,
      });
      expect(service.getById).toHaveBeenCalledWith(IQP_ID);
      expect(service.list).not.toHaveBeenCalled();
    });

    it('lists with the query strings turned into typed filters otherwise', async () => {
      await expect(
        controller.getById({
          iqp_item_id: ITEM_ID,
          iqp_price_level: '2',
          iqp_is_active: 'false',
          page: '2',
          limit: '10',
        }),
      ).resolves.toEqual({
        success: true,
        message: 'Item qty prices fetched successfully',
        data: [PAYLOAD],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({
          iqp_item_id: ITEM_ID,
          iqp_price_level: 2,
          iqp_is_active: false,
          page: 2,
          limit: 10,
        }),
      );
    });

    it('refuses a filter id that is not a uuid', async () => {
      const refusal = await refusalOf(controller.getById({ iqp_item_id: 'item-1' }));

      expect(refusal.status).toBe(400);
      expect(service.list).not.toHaveBeenCalled();
    });
  });

  // ── DELETE delete / POST restore ──────────────────────────────────────────
  describe('remove', () => {
    it('deletes the one slab a body names', async () => {
      await expect(controller.remove({ iqp_id: ` ${IQP_ID} ` })).resolves.toEqual({
        success: true,
        message: 'Item qty price deleted successfully',
        data: { iqp_id: IQP_ID, deleted: true },
      });
      expect(service.softDelete).toHaveBeenCalledWith(IQP_ID);
    });

    it('deletes every slab an array body names', async () => {
      await expect(
        controller.remove([{ iqp_id: IQP_ID }, { iqp_id: OTHER_IQP_ID }]),
      ).resolves.toMatchObject({ message: 'Item qty prices deleted successfully' });
      expect(service.softDelete).toHaveBeenCalledWith([IQP_ID, OTHER_IQP_ID]);
    });

    it('takes the query iqp_id when the body is empty', async () => {
      await controller.remove({}, IQP_ID);

      expect(service.softDelete).toHaveBeenCalledWith(IQP_ID);
    });

    it.each([
      ['no body and no iqp_id', undefined],
      ['a blank iqp_id', '   '],
    ])('refuses %s with ITEM_QTY_PRICE_ID_REQUIRED', async (_label, iqpId) => {
      const refusal = await refusalOf(controller.remove(undefined, iqpId));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'iqp_id', code: ItemQtyPriceErrorCode.ID_REQUIRED }] },
      });
      expect(service.softDelete).not.toHaveBeenCalled();
    });

    it('refuses an iqp_id that is not a uuid', async () => {
      const refusal = await refusalOf(controller.remove(undefined, 'slab-1'));

      expect(refusal.status).toBe(400);
      expect(service.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('restores the one slab the query names', async () => {
      await expect(controller.restore(undefined, IQP_ID)).resolves.toEqual({
        success: true,
        message: 'Item qty price restored successfully',
        data: { iqp_id: IQP_ID, deleted: false },
      });
      expect(service.restore).toHaveBeenCalledWith(IQP_ID);
    });

    it('restores every slab an array body names', async () => {
      await expect(controller.restore([{ iqp_id: IQP_ID }])).resolves.toMatchObject({
        message: 'Item qty prices restored successfully',
        data: [{ iqp_id: IQP_ID, deleted: false }],
      });
    });

    it('says "updated" for a batch that came back mixed', async () => {
      service.restore.mockResolvedValue([
        { iqp_id: IQP_ID, deleted: false },
        { iqp_id: OTHER_IQP_ID, deleted: true },
      ]);

      await expect(
        controller.restore([{ iqp_id: IQP_ID }, { iqp_id: OTHER_IQP_ID }]),
      ).resolves.toMatchObject({ message: 'Item qty prices updated successfully' });
    });
  });
});
