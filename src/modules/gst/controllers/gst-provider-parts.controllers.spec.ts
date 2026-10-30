import { GstProviderPartsService } from '../config/gst-provider-parts.service';
import type {
  GstProviderEndpointPayload,
  GstProviderErrorMapPayload,
  GstProviderFieldMapPayload,
  GstProviderServicePayload,
} from '../types/gst-config.types';
import {
  GstProviderEndpointController,
  GstProviderErrorMapController,
  GstProviderFieldMapController,
  GstProviderServiceController,
} from './gst-provider-parts.controllers';

const PROVIDER_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const SERVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const ENDPOINT_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const FIELD_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const ERROR_MAP_ID = '019c6f6c-be87-7a11-8905-36092c46e501';

const SERVICE = { gpsId: SERVICE_ID } as GstProviderServicePayload;
const ENDPOINT = { gpeId: ENDPOINT_ID, fieldMaps: [] } as unknown as GstProviderEndpointPayload;
const FIELD_MAP = { gfmId: FIELD_MAP_ID } as GstProviderFieldMapPayload;
const ERROR_MAP = { gemId: ERROR_MAP_ID } as GstProviderErrorMapPayload;

const serviceBody = {
  gpsGpvId: PROVIDER_ID,
  gpsService: 'EINVOICE',
  gpsEnvironment: 'SANDBOX',
  gpsBaseUrl: 'https://einv-apisandbox.nic.in',
  gpsAuthScheme: 'NIC_SEK',
};
const endpointBody = { gpeGpsId: SERVICE_ID, gpeAction: 'AUTH', gpePathTemplate: '/auth' };
const fieldMapBody = {
  gfmGpeId: ENDPOINT_ID,
  gfmDirection: 'RESPONSE',
  gfmOurField: 'auth_token',
  gfmTheirPath: '$.AuthToken',
};
const errorMapBody = { gemGpvId: PROVIDER_ID, gemTheirCode: '2150', gemOurCode: 'DUPLICATE_IRN' };

describe('GST provider parts controllers (R2–R5)', () => {
  let parts: {
    saveService: jest.Mock;
    deleteService: jest.Mock;
    getEndpoint: jest.Mock;
    saveEndpoint: jest.Mock;
    deleteEndpoint: jest.Mock;
    saveFieldMap: jest.Mock;
    deleteFieldMap: jest.Mock;
    saveErrorMap: jest.Mock;
    deleteErrorMap: jest.Mock;
  };
  let service: GstProviderPartsService;

  beforeEach(() => {
    parts = {
      saveService: jest.fn().mockResolvedValue(SERVICE),
      deleteService: jest
        .fn()
        .mockResolvedValue({ gpsId: SERVICE_ID, deleted: true, endpointsDeleted: 2 }),
      getEndpoint: jest.fn().mockResolvedValue(ENDPOINT),
      saveEndpoint: jest.fn().mockResolvedValue(ENDPOINT),
      deleteEndpoint: jest
        .fn()
        .mockResolvedValue({ gpeId: ENDPOINT_ID, deleted: true, fieldMapsDeleted: 3 }),
      saveFieldMap: jest.fn().mockResolvedValue(FIELD_MAP),
      deleteFieldMap: jest.fn().mockResolvedValue({ gfmId: FIELD_MAP_ID, deleted: true }),
      saveErrorMap: jest.fn().mockResolvedValue(ERROR_MAP),
      deleteErrorMap: jest.fn().mockResolvedValue({ gemId: ERROR_MAP_ID, deleted: true }),
    };
    service = parts as unknown as GstProviderPartsService;
  });

  // ── R2 /gst/provider-services ─────────────────────────────────────────────

  describe('GstProviderServiceController', () => {
    let controller: GstProviderServiceController;
    beforeEach(() => {
      controller = new GstProviderServiceController(service);
    });

    it('words a body without gpsId as a create', async () => {
      await expect(controller.create(serviceBody)).resolves.toEqual({
        success: true,
        message: 'GST provider service created successfully',
        data: SERVICE,
      });
      expect(parts.saveService).toHaveBeenCalledWith(serviceBody);
    });

    it('words a body with gpsId as an update', async () => {
      const body = { ...serviceBody, gpsId: SERVICE_ID };

      await expect(controller.create(body)).resolves.toMatchObject({
        message: 'GST provider service updated successfully',
      });
      expect(parts.saveService).toHaveBeenCalledWith(body);
    });

    it('deletes by the id in the body and passes the cascade count on', async () => {
      await expect(controller.delete({ gpsId: SERVICE_ID })).resolves.toEqual({
        success: true,
        message: 'GST provider service deleted successfully',
        data: { gpsId: SERVICE_ID, deleted: true, endpointsDeleted: 2 },
      });
      expect(parts.deleteService).toHaveBeenCalledWith(SERVICE_ID);
    });
  });

  // ── R3 /gst/provider-endpoints ────────────────────────────────────────────

  describe('GstProviderEndpointController', () => {
    let controller: GstProviderEndpointController;
    beforeEach(() => {
      controller = new GstProviderEndpointController(service);
    });

    it('words a body without gpeId as a create and one with it as an update', async () => {
      await expect(controller.create(endpointBody)).resolves.toEqual({
        success: true,
        message: 'GST provider endpoint created successfully',
        data: ENDPOINT,
      });
      await expect(
        controller.create({ ...endpointBody, gpeId: ENDPOINT_ID }),
      ).resolves.toMatchObject({ message: 'GST provider endpoint updated successfully' });
      expect(parts.saveEndpoint).toHaveBeenCalledTimes(2);
    });

    it('reads one endpoint by the id in the query', async () => {
      await expect(controller.get({ gpeId: ENDPOINT_ID })).resolves.toEqual({
        success: true,
        message: 'GST provider endpoint fetched successfully',
        data: ENDPOINT,
      });
      expect(parts.getEndpoint).toHaveBeenCalledWith(ENDPOINT_ID);
    });

    it('deletes by the id in the body and passes the field-map count on', async () => {
      await expect(controller.delete({ gpeId: ENDPOINT_ID })).resolves.toEqual({
        success: true,
        message: 'GST provider endpoint deleted successfully',
        data: { gpeId: ENDPOINT_ID, deleted: true, fieldMapsDeleted: 3 },
      });
      expect(parts.deleteEndpoint).toHaveBeenCalledWith(ENDPOINT_ID);
    });
  });

  // ── R4 /gst/provider-field-maps ───────────────────────────────────────────

  describe('GstProviderFieldMapController', () => {
    let controller: GstProviderFieldMapController;
    beforeEach(() => {
      controller = new GstProviderFieldMapController(service);
    });

    it('words a body without gfmId as a create and one with it as an update', async () => {
      await expect(controller.create(fieldMapBody)).resolves.toEqual({
        success: true,
        message: 'GST field map created successfully',
        data: FIELD_MAP,
      });
      await expect(
        controller.create({ ...fieldMapBody, gfmId: FIELD_MAP_ID }),
      ).resolves.toMatchObject({ message: 'GST field map updated successfully' });
      expect(parts.saveFieldMap).toHaveBeenLastCalledWith({ ...fieldMapBody, gfmId: FIELD_MAP_ID });
    });

    it('deletes by the id in the body', async () => {
      await expect(controller.delete({ gfmId: FIELD_MAP_ID })).resolves.toEqual({
        success: true,
        message: 'GST field map deleted successfully',
        data: { gfmId: FIELD_MAP_ID, deleted: true },
      });
      expect(parts.deleteFieldMap).toHaveBeenCalledWith(FIELD_MAP_ID);
    });
  });

  // ── R5 /gst/provider-error-maps ───────────────────────────────────────────

  describe('GstProviderErrorMapController', () => {
    let controller: GstProviderErrorMapController;
    beforeEach(() => {
      controller = new GstProviderErrorMapController(service);
    });

    it('words a body without gemId as a create and one with it as an update', async () => {
      await expect(controller.create(errorMapBody)).resolves.toEqual({
        success: true,
        message: 'GST error map created successfully',
        data: ERROR_MAP,
      });
      await expect(
        controller.create({ ...errorMapBody, gemId: ERROR_MAP_ID }),
      ).resolves.toMatchObject({ message: 'GST error map updated successfully' });
      expect(parts.saveErrorMap).toHaveBeenLastCalledWith({ ...errorMapBody, gemId: ERROR_MAP_ID });
    });

    it('deletes by the id in the body', async () => {
      await expect(controller.delete({ gemId: ERROR_MAP_ID })).resolves.toEqual({
        success: true,
        message: 'GST error map deleted successfully',
        data: { gemId: ERROR_MAP_ID, deleted: true },
      });
      expect(parts.deleteErrorMap).toHaveBeenCalledWith(ERROR_MAP_ID);
    });
  });

  it('lets a service refusal through untouched for the filter to word', async () => {
    const refusal = new Error('refused');
    parts.saveService.mockRejectedValue(refusal);

    await expect(new GstProviderServiceController(service).create(serviceBody)).rejects.toBe(
      refusal,
    );
  });
});
