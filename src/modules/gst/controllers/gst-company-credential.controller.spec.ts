import { GstCompanyCredentialService } from '../config/gst-company-credential.service';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import type { GstCompanyCredentialPayload, GstCredentialStatus } from '../types/gst-config.types';
import { GstCompanyCredentialController } from './gst-company-credential.controller';

const GCC_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e004';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e007';

const PAYLOAD = { gccId: GCC_ID, hasPassword: true } as GstCompanyCredentialPayload;
const STATUS = { gccId: GCC_ID, hasLiveToken: true, leaseFree: true } as GstCredentialStatus;

const body = (extra: Partial<SaveGstCompanyCredentialDto> = {}): SaveGstCompanyCredentialDto => ({
  gccCompanyId: COMPANY_ID,
  gccGpvId: GPV_ID,
  gccEnvironment: 'SANDBOX',
  gccLoginId: 'api_user',
  gccValidFrom: '2026-04-01',
  ...extra,
});

describe('GstCompanyCredentialController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
    verify: jest.Mock;
    status: jest.Mock;
  };
  let controller: GstCompanyCredentialController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ gccId: GCC_ID, deleted: true }),
      restore: jest.fn().mockResolvedValue({ gccId: GCC_ID, deleted: false }),
      verify: jest.fn().mockResolvedValue({ ok: true, message: 'Signed in', creditBalance: null }),
      status: jest.fn().mockResolvedValue(STATUS),
    };
    controller = new GstCompanyCredentialController(
      service as unknown as GstCompanyCredentialService,
    );
  });

  it('words a save without gccId as a create', async () => {
    const dto = body({ password: 'secret' });

    await expect(controller.create(dto)).resolves.toEqual({
      success: true,
      message: 'GST credential created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with gccId as an update', async () => {
    const dto = body({ gccId: GCC_ID });

    await expect(controller.create(dto)).resolves.toMatchObject({
      message: 'GST credential updated successfully',
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('wraps a get, reading the id from the query', async () => {
    await expect(controller.get({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(GCC_ID);
  });

  it('wraps a delete and a restore, reading the id from the body', async () => {
    await expect(controller.delete({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential deleted successfully',
      data: { gccId: GCC_ID, deleted: true },
    });
    await expect(controller.restore({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential restored successfully',
      data: { gccId: GCC_ID, deleted: false },
    });
    expect(service.softDelete).toHaveBeenCalledWith(GCC_ID);
    expect(service.restore).toHaveBeenCalledWith(GCC_ID);
  });

  it('words a verify by whether the portal let the credential in', async () => {
    await expect(controller.verify({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential verified',
      data: { ok: true, message: 'Signed in', creditBalance: null },
    });

    const refused = {
      ok: false,
      message: 'Invalid password',
      errorCode: 'GSP_AUTH_FAILED',
      creditBalance: null,
    };
    service.verify.mockResolvedValue(refused);

    // A refusal BY the portal is still a 2xx: the body carries ok: false.
    await expect(controller.verify({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential verification failed',
      data: refused,
    });
    expect(service.verify).toHaveBeenCalledWith(GCC_ID);
  });

  it('wraps the status', async () => {
    await expect(controller.status({ gccId: GCC_ID })).resolves.toEqual({
      success: true,
      message: 'GST credential status fetched successfully',
      data: STATUS,
    });
    expect(service.status).toHaveBeenCalledWith(GCC_ID);
  });
});
