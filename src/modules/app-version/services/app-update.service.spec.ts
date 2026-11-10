import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type AppRelease } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { AppUpdateService, mostUrgent } from './app-update.service';

const release = (build: number, overrides: Partial<AppRelease> = {}): AppRelease => ({
  arlId: `id-${build}`,
  arlPlatform: 'desktop',
  arlBuild: build,
  arlVersion: `1.${build}.0`,
  arlCommit: null,
  arlSeverity: 'normal',
  arlNotes: null,
  arlDownloadUrl: null,
  arlReleasedAt: new Date('2026-11-10T10:00:00.000Z'),
  arlIsActive: true,
  arlIsDeleted: false,
  arlSyncDate: null,
  arlCreatedOn: new Date('2026-11-10T10:00:00.000Z'),
  arlCreatedBy: 'ops',
  arlModifiedOn: null,
  arlModifiedBy: null,
  ...overrides,
});

const errorCode = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error: unknown) {
    return (error as { getResponse(): { errors: { code: string }[] } }).getResponse().errors[0]
      .code;
  }
  throw new Error('expected a refusal');
};

describe('AppUpdateService (Part B Step 2)', () => {
  let prisma: {
    appRelease: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    clientInstallation: { aggregate: jest.Mock };
  };
  let service: AppUpdateService;

  beforeEach(() => {
    prisma = {
      appRelease: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => Promise.resolve(release(data.arlBuild, data))),
        update: jest.fn(({ data }) => Promise.resolve(release(12, data))),
      },
      clientInstallation: { aggregate: jest.fn().mockResolvedValue({ _max: { cinBuild: null } }) },
    };
    service = new AppUpdateService(prisma as unknown as PrismaService);
  });

  describe('check', () => {
    it('severity is the most urgent MISSED build: a critical 11 is not hidden by a normal 12', async () => {
      prisma.appRelease.findMany.mockResolvedValue([
        { arlSeverity: 'normal' },
        { arlSeverity: 'critical' },
      ]);
      prisma.appRelease.findFirst.mockResolvedValue(
        release(12, { arlDownloadUrl: 'https://x/12' }),
      );
      await expect(service.check('desktop', 10)).resolves.toEqual({
        platform: 'desktop',
        currentBuild: 10,
        updateAvailable: true,
        severity: 'critical',
        latestBuild: 12,
        latestVersion: '1.12.0',
        downloadUrl: 'https://x/12',
        notes: null,
        releasedAt: '2026-11-10T10:00:00.000Z',
        missedBuilds: 2,
      });
      // only live releases, and only those above the client's build
      expect(prisma.appRelease.findMany).toHaveBeenCalledWith({
        where: {
          arlPlatform: 'desktop',
          arlIsDeleted: false,
          arlIsActive: true,
          arlBuild: { gt: 10 },
        },
        select: { arlSeverity: true },
      });
      expect(prisma.appRelease.findFirst).toHaveBeenCalledWith({
        where: { arlPlatform: 'desktop', arlIsDeleted: false, arlIsActive: true },
        orderBy: { arlBuild: 'desc' },
      });
    });

    it('up to date: no update, no severity, latest still reported', async () => {
      prisma.appRelease.findFirst.mockResolvedValue(release(12));
      await expect(service.check('desktop', 12)).resolves.toMatchObject({
        updateAvailable: false,
        severity: null,
        latestBuild: 12,
        missedBuilds: 0,
      });
    });

    it('no release at all for the platform', async () => {
      await expect(service.check('mobile', 1)).resolves.toMatchObject({
        updateAvailable: false,
        severity: null,
        latestBuild: null,
        releasedAt: null,
      });
    });

    it('mostUrgent ranks normal < recommended < critical and reads junk as normal', () => {
      expect(mostUrgent([])).toBe('normal');
      expect(mostUrgent(['normal', 'recommended'])).toBe('recommended');
      expect(mostUrgent(['bogus', 'recommended', 'critical', 'normal'])).toBe('critical');
    });
  });

  describe('createRelease', () => {
    const dto = { platform: 'desktop' as const, build: 12, version: '1.2.0' };

    it('creates with created_on / created_by and defaults severity to normal', async () => {
      const created = await service.createRelease(dto, 'ops:ci');
      expect(prisma.appRelease.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          arlPlatform: 'desktop',
          arlBuild: 12,
          arlVersion: '1.2.0',
          arlSeverity: 'normal',
          arlCommit: null,
          arlCreatedBy: 'ops:ci',
          arlCreatedOn: expect.any(Date),
          arlReleasedAt: expect.any(Date),
        }),
      });
      expect(created).toMatchObject({ platform: 'desktop', build: 12, createdBy: 'ops:ci' });
    });

    it('409 APP_RELEASE_BUILD_EXISTS for a registered build, yanked or not', async () => {
      prisma.appRelease.findUnique.mockResolvedValue({ arlIsDeleted: true });
      await expect(errorCode(service.createRelease(dto, 'ops'))).resolves.toBe(
        'APP_RELEASE_BUILD_EXISTS',
      );
      expect(prisma.appRelease.create).not.toHaveBeenCalled();
    });

    it('409 APP_RELEASE_BUILD_TOO_LOW below a build clients already run; equal or between is fine', async () => {
      prisma.clientInstallation.aggregate.mockResolvedValue({ _max: { cinBuild: 10 } });
      await expect(service.createRelease({ ...dto, build: 5 }, 'ops')).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(errorCode(service.createRelease({ ...dto, build: 9 }, 'ops'))).resolves.toBe(
        'APP_RELEASE_BUILD_TOO_LOW',
      );
      await expect(service.createRelease({ ...dto, build: 10 }, 'ops')).resolves.toMatchObject({
        build: 10,
      });
      await expect(service.createRelease({ ...dto, build: 11 }, 'ops')).resolves.toMatchObject({
        build: 11,
      });
      expect(prisma.clientInstallation.aggregate).toHaveBeenCalledWith({
        where: { cinPlatform: 'desktop', cinIsDeleted: false, cinBuild: { not: null } },
        _max: { cinBuild: true },
      });
    });

    it('a racing duplicate insert (P2002) answers 409, not 500', async () => {
      prisma.appRelease.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(errorCode(service.createRelease(dto, 'ops'))).resolves.toBe(
        'APP_RELEASE_BUILD_EXISTS',
      );
    });
  });

  describe('updateRelease', () => {
    it('404 APP_RELEASE_NOT_FOUND', async () => {
      await expect(
        service.updateRelease('desktop', 99, { isDeleted: true }, 'ops'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('yank: writes only what was sent, plus modified_on / modified_by', async () => {
      prisma.appRelease.findUnique.mockResolvedValue(release(12));
      await service.updateRelease('desktop', 12, { isDeleted: true }, 'ops:support');
      expect(prisma.appRelease.update).toHaveBeenCalledWith({
        where: { arlPlatform_arlBuild: { arlPlatform: 'desktop', arlBuild: 12 } },
        data: {
          arlIsDeleted: true,
          arlModifiedOn: expect.any(Date),
          arlModifiedBy: 'ops:support',
        },
      });
    });

    it('null clears a nullable field; null on a NOT NULL field is ignored', async () => {
      prisma.appRelease.findUnique.mockResolvedValue(release(12, { arlNotes: 'old' }));
      await service.updateRelease(
        'desktop',
        12,
        { notes: null, version: null as unknown as string, severity: 'critical' },
        'ops',
      );
      const { data } = prisma.appRelease.update.mock.calls[0][0];
      expect(data).toMatchObject({ arlNotes: null, arlSeverity: 'critical' });
      expect(data).not.toHaveProperty('arlVersion');
    });

    it('nothing sent: no write', async () => {
      prisma.appRelease.findUnique.mockResolvedValue(release(12));
      await expect(service.updateRelease('desktop', 12, {}, 'ops')).resolves.toMatchObject({
        build: 12,
        modifiedOn: null,
      });
      expect(prisma.appRelease.update).not.toHaveBeenCalled();
    });
  });
});
