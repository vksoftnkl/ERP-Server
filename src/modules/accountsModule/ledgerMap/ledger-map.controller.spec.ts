import { LedgerMapController } from './ledger-map.controller';
import { LedgerMapService } from './ledger-map.service';
import { LedgerMapRolePayload } from './types/ledger-map-api.types';

const ALM_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const ROLE = {
  role: 'DISCOUNT_ALLOWED',
  almId: ALM_ID,
  ledgerId: LEDGER_ID,
} as LedgerMapRolePayload;

describe('LedgerMapController', () => {
  let service: { listRoles: jest.Mock; save: jest.Mock; softDelete: jest.Mock };
  let controller: LedgerMapController;

  beforeEach(() => {
    service = {
      listRoles: jest.fn().mockResolvedValue([ROLE]),
      save: jest.fn().mockResolvedValue(ROLE),
      softDelete: jest
        .fn()
        .mockResolvedValue({ almId: ALM_ID, role: 'DISCOUNT_ALLOWED', deleted: true }),
    };
    controller = new LedgerMapController(service as unknown as LedgerMapService);
  });

  it('listRoles wraps the catalogue', async () => {
    await expect(controller.listRoles()).resolves.toEqual({
      success: true,
      message: 'Posting roles fetched successfully',
      data: [ROLE],
    });
  });

  it.each([
    [
      'mapped',
      { role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID },
      'Posting ledger mapped successfully',
    ],
    [
      're-pointed',
      { almId: ALM_ID, role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID },
      'Posting ledger mapping updated successfully',
    ],
  ])('save says %s by whether the body names an almId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: ROLE });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('remove unmaps by the almId in the query', async () => {
    await expect(controller.remove({ almId: ALM_ID })).resolves.toEqual({
      success: true,
      message: 'Posting ledger mapping removed successfully',
      data: { almId: ALM_ID, role: 'DISCOUNT_ALLOWED', deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(ALM_ID);
  });
});
