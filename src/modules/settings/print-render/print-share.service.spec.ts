import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PrintLogService } from './print-log.service';
import { PrintRenderService } from './print-render.service';
import {
  PRINT_SHARE_DEFAULT_TTL_DAYS,
  PRINT_SHARE_TOKEN_PATTERN,
  PrintShareService,
  safeFileStem,
  shareTtlDays,
} from './print-share.service';

const VERSION = '01a13e3b-8a1c-7132-83df-70fca264aa0b';
const DOC = '01a162ac-d84f-7dc0-9675-86e7155268ac';
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';

function build() {
  const prisma = {
    printTemplateVersion: { findUnique: jest.fn() },
    printShareLink: { create: jest.fn(), findUnique: jest.fn() },
  };
  const printRender = { preview: jest.fn() };
  const printLog = { currentAccYear: jest.fn().mockResolvedValue('2027-2028') };
  const service = new PrintShareService(
    prisma as unknown as PrismaService,
    printRender as unknown as PrintRenderService,
    printLog as unknown as PrintLogService,
  );
  return { service, prisma, printRender, printLog };
}

const input = {
  versionId: VERSION,
  docId: DOC,
  companyId: COMPANY,
  branchId: BRANCH,
  accYear: '2026-2027',
  deviceId: null,
  userId: USER,
  filename: 'bill-bil00016',
};

describe('PrintShareService.create', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('stores the frozen context under a 22-character random token', async () => {
    const { service, prisma } = build();
    prisma.printTemplateVersion.findUnique.mockResolvedValue({ ptvId: VERSION, ptvIsDeleted: false });
    delete process.env.PRINT_SHARE_PUBLIC_BASE_URL;
    delete process.env.PRINT_SHARE_TTL_DAYS;

    const before = Date.now();
    const created = await service.create(input);

    expect(created.token).toMatch(PRINT_SHARE_TOKEN_PATTERN);
    expect(created.path).toBe(`/print-share/${created.token}/bill-bil00016.pdf`);
    expect(created.url).toBeNull();
    const data = prisma.printShareLink.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      pslToken: created.token,
      pslVersionId: VERSION,
      pslDocId: DOC,
      pslCompanyId: COMPANY,
      pslBranchId: BRANCH,
      pslAccYear: '2026-2027',
      pslFilename: 'bill-bil00016',
      pslCreatedBy: USER,
    });
    const ttlMs = (data.pslExpiresOn as Date).getTime() - before;
    expect(Math.round(ttlMs / 86_400_000)).toBe(PRINT_SHARE_DEFAULT_TTL_DAYS);
  });

  it('never reuses a token', async () => {
    const { service, prisma } = build();
    prisma.printTemplateVersion.findUnique.mockResolvedValue({ ptvId: VERSION, ptvIsDeleted: false });
    const a = await service.create(input);
    const b = await service.create(input);
    expect(a.token).not.toBe(b.token);
  });

  it("keeps the DOCUMENT's year, and asks for the current one only when none is named", async () => {
    const { service, prisma, printLog } = build();
    prisma.printTemplateVersion.findUnique.mockResolvedValue({ ptvId: VERSION, ptvIsDeleted: false });

    await service.create(input);
    expect(printLog.currentAccYear).not.toHaveBeenCalled();

    await service.create({ ...input, accYear: null });
    expect(prisma.printShareLink.create.mock.calls[1][0].data.pslAccYear).toBe('2027-2028');
  });

  it('answers with a full URL when the server knows its public address', async () => {
    const { service, prisma } = build();
    prisma.printTemplateVersion.findUnique.mockResolvedValue({ ptvId: VERSION, ptvIsDeleted: false });
    process.env.PRINT_SHARE_PUBLIC_BASE_URL = 'https://erp.example.com/api/v1/';
    const created = await service.create(input);
    expect(created.url).toBe(`https://erp.example.com/api/v1/print-share/${created.token}/bill-bil00016.pdf`);
  });

  it('refuses a revision that does not exist or was deleted', async () => {
    const { service, prisma } = build();
    prisma.printTemplateVersion.findUnique.mockResolvedValue(null);
    await expect(service.create(input)).rejects.toBeInstanceOf(NotFoundException);
    prisma.printTemplateVersion.findUnique.mockResolvedValue({ ptvId: VERSION, ptvIsDeleted: true });
    await expect(service.create(input)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.printShareLink.create).not.toHaveBeenCalled();
  });
});

describe('PrintShareService.open', () => {
  const link = {
    pslId: 'link-1',
    pslToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    pslVersionId: VERSION,
    pslDocId: DOC,
    pslCompanyId: COMPANY,
    pslBranchId: BRANCH,
    pslAccYear: '2026-2027',
    pslDeviceId: null,
    pslFilename: 'bill-bil00016',
    pslCreatedBy: USER,
  };

  it('never asks the database about a malformed token', async () => {
    const { service, prisma } = build();
    await expect(service.open("x' or 1=1")).resolves.toEqual({ status: 'MISSING' });
    await expect(service.open('short')).resolves.toEqual({ status: 'MISSING' });
    expect(prisma.printShareLink.findUnique).not.toHaveBeenCalled();
  });

  it('answers MISSING for an unknown token', async () => {
    const { service, prisma } = build();
    prisma.printShareLink.findUnique.mockResolvedValue(null);
    await expect(service.open(link.pslToken)).resolves.toEqual({ status: 'MISSING' });
  });

  it('answers EXPIRED, and renders nothing, once the link has run out', async () => {
    const { service, prisma, printRender } = build();
    const expiredOn = new Date(Date.now() - 1000);
    prisma.printShareLink.findUnique.mockResolvedValue({ ...link, pslExpiresOn: expiredOn });
    await expect(service.open(link.pslToken)).resolves.toEqual({ status: 'EXPIRED', expiredOn });
    expect(printRender.preview).not.toHaveBeenCalled();
  });

  it('renders the frozen context as a PDF', async () => {
    const { service, prisma, printRender } = build();
    prisma.printShareLink.findUnique.mockResolvedValue({
      ...link,
      pslExpiresOn: new Date(Date.now() + 86_400_000),
    });
    const outcome = { bytes: Buffer.from('%PDF'), contentType: 'application/pdf', extension: 'pdf' };
    printRender.preview.mockResolvedValue(outcome);

    await expect(service.open(link.pslToken)).resolves.toEqual({
      status: 'OK',
      outcome,
      filename: 'bill-bil00016',
    });
    expect(printRender.preview).toHaveBeenCalledWith({
      versionId: VERSION,
      context: {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: '2026-2027',
        docId: DOC,
        userId: USER,
        deviceId: null,
      },
      params: {},
      docIds: [DOC],
      outputMode: 'PDF',
    });
  });
});

describe('safeFileStem / shareTtlDays', () => {
  it('makes a file name safe for a URL and a header', () => {
    expect(safeFileStem('bill-bil00016')).toBe('bill-bil00016');
    expect(safeFileStem('bill "x"/../y')).toBe('bill-x-..-y');
    expect(safeFileStem('')).toBe('document');
    expect(safeFileStem(null)).toBe('document');
  });

  it('reads the TTL in days, clamped, defaulting on nonsense', () => {
    expect(shareTtlDays(undefined)).toBe(PRINT_SHARE_DEFAULT_TTL_DAYS);
    expect(shareTtlDays('abc')).toBe(PRINT_SHARE_DEFAULT_TTL_DAYS);
    expect(shareTtlDays('0')).toBe(PRINT_SHARE_DEFAULT_TTL_DAYS);
    expect(shareTtlDays('7')).toBe(7);
    expect(shareTtlDays('5000')).toBe(366);
  });
});
