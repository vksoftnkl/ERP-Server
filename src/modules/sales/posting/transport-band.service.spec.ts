import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TransportBandService, type TransportDocRef } from './transport-band.service';
import { SALES_ERROR_CODES } from './types/posting.types';

const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46ad01';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46ad02';
const NOW = new Date('2026-10-19T06:00:00.000Z');

const REF: TransportDocRef = {
  docType: 'SALE_BILL',
  docId: DOC_ID,
  accYear: '2026-2027',
  companyId: 'company-1',
  branchId: 'branch-1',
  docRefno: 'bil00042',
};

/** A stored band row, every column null unless named. */
const bandRow = (overrides: Record<string, unknown> = {}) => {
  const ends = ['GodownId', 'BranchId', 'AddrId', 'Name', 'Addr', 'Place', 'Pin', 'Phone', 'Stcd', 'Gstin'];
  const row: Record<string, unknown> = {
    ttdId: 'ttd-1',
    ttdDirection: 'OUTWARD',
    ttdTransportMode: null,
    ttdTransporterId: null,
    ttdTransporterName: null,
    ttdTransporterGstin: null,
    ttdLrNo: null,
    ttdLrDate: null,
    ttdDistanceKm: null,
    ttdRemarks: null,
  };
  for (const e of ends) {
    row[`ttdFrom${e}`] = null;
    row[`ttdTo${e}`] = null;
  }
  return { ...row, ...overrides };
};

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

describe('TransportBandService', () => {
  describe('hasContent', () => {
    it('is false for nothing and for a band whose every field is blank', () => {
      expect(TransportBandService.hasContent(null)).toBe(false);
      expect(
        TransportBandService.hasContent({
          direction: 'OUTWARD',
          from: { name: '', pin: null },
          to: {},
          mode: '',
          distanceKm: null,
        }),
      ).toBe(false);
    });

    it.each([
      [{ to: { pin: '600001' } }],
      [{ mode: 'ROAD' }],
      [{ lrNo: 'LR-9' }],
      [{ lrDate: '2026-10-19' }],
      [{ transporterGstin: '33ABCDE1234F1Z5' }],
      [{ distanceKm: 0 }],
    ])('is true once %o is given', (fields) => {
      expect(TransportBandService.hasContent({ direction: 'OUTWARD', ...fields })).toBe(true);
    });
  });

  describe('read', () => {
    it('answers null for a document with no band', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const service = new TransportBandService({
        txnTransportDetail: { findFirst },
      } as unknown as PrismaService);

      await expect(service.read(REF)).resolves.toBeNull();
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          ttdDocType: 'SALE_BILL',
          ttdDocId: DOC_ID,
          ttdAccYear: '2026-2027',
          ttdIsDeleted: false,
        },
      });
    });

    it('maps the stored row into the two ends, with the LR date as a day', async () => {
      const findFirst = jest.fn().mockResolvedValue(
        bandRow({
          ttdDirection: 'INWARD',
          ttdFromName: 'Main godown',
          ttdToPin: '600001',
          ttdLrDate: new Date('2026-10-18T00:00:00.000Z'),
          ttdDistanceKm: 42,
        }),
      );
      const service = new TransportBandService({} as PrismaService);

      const band = await service.read(REF, {
        txnTransportDetail: { findFirst },
      } as unknown as Prisma.TransactionClient);

      expect(band).toMatchObject({
        ttdId: 'ttd-1',
        direction: 'INWARD',
        from: { name: 'Main godown', pin: null },
        to: { pin: '600001' },
        lrDate: '2026-10-18',
        distanceKm: 42,
      });
    });
  });

  describe('write', () => {
    const writeTx = (existing: { ttdId: string } | null, declared = false) => {
      const delegate = {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => bandRow(data)),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => bandRow(data)),
      };
      const tx = {
        txnTransportDetail: delegate,
        $queryRaw: jest.fn().mockResolvedValue([{ irn_live: declared, ewb_live: false }]),
      } as unknown as Prisma.TransactionClient;
      return { tx, delegate };
    };
    const service = new TransportBandService({} as PrismaService);

    it('creates the band for a document that has none, keyed on the document', async () => {
      const { tx, delegate } = writeTx(null);

      const band = await service.write(
        tx,
        REF,
        { direction: 'OUTWARD', to: { name: 'Ravi Stores', pin: '600001' }, lrDate: '2026-10-19' },
        'actor-1',
        { gdrId: null, now: NOW },
      );

      expect(delegate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ttdCompanyId: 'company-1',
          ttdBranchId: 'branch-1',
          ttdTenantId: null,
          ttdAccYear: '2026-2027',
          ttdDocType: 'SALE_BILL',
          ttdDocId: DOC_ID,
          ttdDocRefno: 'bil00042',
          ttdToName: 'Ravi Stores',
          ttdFromName: null,
          ttdLrDate: new Date('2026-10-19T00:00:00Z'),
          ttdCreatedOn: NOW,
          ttdCreatedBy: 'actor-1',
        }) as object,
      });
      expect(band.to).toMatchObject({ name: 'Ravi Stores', pin: '600001' });
    });

    it('updates the existing band in place, stamping who changed it', async () => {
      const { tx, delegate } = writeTx({ ttdId: 'ttd-9' });

      await service.write(tx, REF, { direction: 'OUTWARD', mode: 'ROAD' }, 'actor-1', {
        gdrId: null,
        now: NOW,
      });

      expect(delegate.create).not.toHaveBeenCalled();
      expect(delegate.update).toHaveBeenCalledWith({
        where: { ttdId_ttdAccYear: { ttdId: 'ttd-9', ttdAccYear: '2026-2027' } },
        data: expect.objectContaining({
          ttdTransportMode: 'ROAD',
          ttdModifiedOn: NOW,
          ttdModifiedBy: 'actor-1',
        }) as object,
      });
    });

    it('refuses once the document has been declared to the portal', async () => {
      const { tx, delegate } = writeTx({ ttdId: 'ttd-9' }, true);

      const refusal = await refusalOf(
        service.write(tx, REF, { direction: 'OUTWARD', mode: 'ROAD' }, 'actor-1', {
          gdrId: GDR_ID,
        }),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DECLARED_LOCKED }] },
      });
      expect(delegate.update).not.toHaveBeenCalled();
    });
  });

  it('remove soft-deletes the live band of the document', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new TransportBandService({} as PrismaService);

    await service.remove(
      { txnTransportDetail: { updateMany } } as unknown as Prisma.TransactionClient,
      REF,
      'actor-1',
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        ttdDocType: 'SALE_BILL',
        ttdDocId: DOC_ID,
        ttdAccYear: '2026-2027',
        ttdIsDeleted: false,
      },
      data: { ttdIsDeleted: true, ttdModifiedOn: expect.any(Date), ttdModifiedBy: 'actor-1' },
    });
  });
});
