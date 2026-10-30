import { ArgumentMetadata, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ItemsTaxHistoryMasterController } from './items-tax-history-master.controller';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';
import { ItemTaxHistoryPayload } from './types/item-tax-history-api.types';

const ITH_ID = '019c6f6c-be87-7a11-8905-36092c46ab01';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46ab02';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ab03';
/** A valid uuid, but version 4. */
const V4_ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';

const PAYLOAD = { ith_id: ITH_ID, ith_item_id: ITEM_ID } as ItemTaxHistoryPayload;
const BODY = { ith_item_id: ITEM_ID, ith_tax_id: TAX_ID, ith_effective_from: '2026-04-01' };

/** The pipe bound to the `ith_id` query parameter of a route. */
const ithIdPipeOf = (method: 'getById' | 'remove'): ParseUUIDPipe => {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, ItemsTaxHistoryMasterController, method) as
    | Record<string, { data?: string; pipes?: unknown[] }>
    | undefined;
  const param = Object.values(args ?? {}).find((arg) => arg.data === 'ith_id');
  return param?.pipes?.[0] as ParseUUIDPipe;
};

const QUERY_META: ArgumentMetadata = { type: 'query', data: 'ith_id' };

describe('ItemsTaxHistoryMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; delete: jest.Mock };
  let controller: ItemsTaxHistoryMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      delete: jest.fn().mockResolvedValue({ ith_id: ITH_ID, deleted: true }),
    };
    controller = new ItemsTaxHistoryMasterController(
      service as unknown as ItemsTaxHistoryMasterService,
    );
  });

  it('words a body without ith_id as a create', async () => {
    await expect(controller.save(BODY)).resolves.toEqual({
      success: true,
      message: 'Item tax history created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(BODY);
  });

  it('words a body with ith_id as an update', async () => {
    await expect(controller.save({ ...BODY, ith_id: ITH_ID })).resolves.toMatchObject({
      message: 'Item tax history updated successfully',
    });
  });

  it('wraps a fetch and a delete', async () => {
    await expect(controller.getById(ITH_ID)).resolves.toEqual({
      success: true,
      message: 'Item tax history fetched successfully',
      data: PAYLOAD,
    });
    await expect(controller.remove(ITH_ID)).resolves.toEqual({
      success: true,
      message: 'Item tax history deleted successfully',
      data: { ith_id: ITH_ID, deleted: true },
    });
    expect(service.getById).toHaveBeenCalledWith(ITH_ID);
    expect(service.delete).toHaveBeenCalledWith(ITH_ID);
  });

  describe.each(['getById', 'remove'] as const)('the ith_id pipe on %s', (method) => {
    it('lets a version-7 uuid through', async () => {
      await expect(ithIdPipeOf(method).transform(ITH_ID, QUERY_META)).resolves.toBe(ITH_ID);
    });

    it.each([
      ['a version-4 uuid', V4_ID],
      ['text that is not a uuid', 'history-1'],
    ])('refuses %s', async (_label, value) => {
      await expect(ithIdPipeOf(method).transform(value, QUERY_META)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
