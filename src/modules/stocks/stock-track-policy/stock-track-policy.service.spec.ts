import { Prisma, StockTrackPolicy, StockTrackPreset } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DERIVED_FROM_GROUP_REMARK,
  DERIVED_FROM_ITEM_REMARK,
  StockTrackPolicyService,
} from './stock-track-policy.service';
import {
  ItemGroupTrackPolicySource,
  ItemTrackPolicySource,
  valuationMethodFor,
} from './types/stock-track-policy.types';

const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const GROUP_ID = '01000000-0000-7000-8000-0000000000f1';
const PRESET_ID = '01000000-0000-7000-8000-0000000000e1';

const item = (overrides: Partial<ItemTrackPolicySource> = {}): ItemTrackPolicySource => ({
  itemId: ITEM_ID,
  itemCompanyId: COMPANY_ID,
  itemBranchId: BRANCH_ID,
  itemTrackPresetId: null,
  ...overrides,
});

const group = (
  overrides: Partial<ItemGroupTrackPolicySource> = {},
): ItemGroupTrackPolicySource => ({
  itgId: GROUP_ID,
  itgTrackPresetId: null,
  ...overrides,
});

/** PHARMA from prisma/seed/Stock_Track_Presets.sql. */
const preset = (overrides: Partial<StockTrackPreset> = {}): StockTrackPreset => ({
  sptId: PRESET_ID,
  sptCompanyId: null,
  sptCode: 'PHARMA',
  sptName: 'Pharma (batch + expiry + MRP + supplier)',
  sptDescription: null,
  sptTrackBatch: true,
  sptTrackMrp: true,
  sptTrackSalePrice: false,
  sptTrackExpiry: true,
  sptTrackSerial: false,
  sptTrackSupplier: true,
  sptTrackSignature: 'BMEP',
  sptValuationMethod: 'LOT_ACTUAL',
  sptIssueStrategy: 'FEFO',
  sptAllowNegative: 'ALLOW',
  sptShelfLifeDays: null,
  sptNearExpiryDays: 90,
  sptBlockExpiredSale: true,
  sptAgeingBasis: 'INWARD_DATE',
  sptSortOrder: 70,
  sptRemarks: null,
  sptIsActive: true,
  sptIsDeleted: false,
  sptSyncDate: null,
  sptCreatedOn: new Date('2026-09-05'),
  sptCreatedBy: null,
  sptModifiedOn: null,
  sptModifiedBy: null,
  ...overrides,
});

const policyRow = (overrides: Partial<StockTrackPolicy> = {}): StockTrackPolicy => ({
  stpId: 'stp1',
  stpCompanyId: COMPANY_ID,
  stpBranchId: BRANCH_ID,
  stpScope: 'ITEM',
  stpScopeId: ITEM_ID,
  stpItemId: ITEM_ID,
  stpGroupId: null,
  stpTrackBatch: false,
  stpTrackMrp: false,
  stpTrackSalePrice: false,
  stpTrackExpiry: false,
  stpTrackSerial: false,
  stpTrackSupplier: false,
  stpTrackSignature: 'N',
  stpValuationMethod: 'WAVG',
  stpIssueStrategy: 'FIFO',
  stpAllowNegative: 'ALLOW',
  stpShelfLifeDays: null,
  stpNearExpiryDays: 30,
  stpBlockExpiredSale: false,
  stpAgeingBasis: 'INWARD_DATE',
  stpEffectiveFrom: new Date('1900-01-01'),
  stpEffectiveTo: new Date('9999-12-31'),
  stpRemarks: DERIVED_FROM_ITEM_REMARK,
  stpIsActive: true,
  stpIsDeleted: false,
  stpSyncDate: null,
  stpCreatedOn: new Date('2026-09-02'),
  stpCreatedBy: null,
  stpModifiedOn: null,
  stpModifiedBy: null,
  ...overrides,
});

describe('StockTrackPolicyService', () => {
  let service: StockTrackPolicyService;
  let client: {
    stockTrackPolicy: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    stockTrackPreset: { findUnique: jest.Mock };
  };
  let auditLogService: { logEntityChange: jest.Mock };

  const tx = () => client as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    client = {
      stockTrackPolicy: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve(policyRow(args.data as Partial<StockTrackPolicy>)),
        ),
        update: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve(policyRow(args.data as Partial<StockTrackPolicy>)),
        ),
      },
      stockTrackPreset: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new StockTrackPolicyService(
      client as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      {
        getUserId: () => USER_ID,
        getCompanyId: () => COMPANY_ID,
      } as unknown as RequestContextService,
    );
  });

  describe('syncFromItem', () => {
    /** The item's row as PHARMA writes it — what a re-save should leave alone. */
    const pharmaRow = (overrides: Partial<StockTrackPolicy> = {}) =>
      policyRow({
        stpTrackBatch: true,
        stpTrackMrp: true,
        stpTrackExpiry: true,
        stpTrackSupplier: true,
        stpTrackSignature: 'BMEP',
        // Notes 92: a tracked row is LOT_ACTUAL — what the service derives.
        stpValuationMethod: 'LOT_ACTUAL',
        stpIssueStrategy: 'FEFO',
        stpNearExpiryDays: 90,
        stpBlockExpiredSale: true,
        stpRemarks: `${DERIVED_FROM_ITEM_REMARK} [preset PHARMA]`,
        ...overrides,
      });
    const withPreset = () => item({ itemTrackPresetId: PRESET_ID });

    it('creates the ITEM-scope row from the preset, writing the scope pair and never the generated columns', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result).toMatchObject({ outcome: 'created', preset_code: 'PHARMA' });
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpScope: 'ITEM',
        stpScopeId: ITEM_ID,
        stpCompanyId: COMPANY_ID,
        stpBranchId: BRANCH_ID,
        stpTrackBatch: true,
        stpTrackMrp: true,
        stpTrackExpiry: true,
        stpTrackSupplier: true,
        stpTrackSalePrice: false,
        stpTrackSerial: false,
        stpBlockExpiredSale: true,
        stpNearExpiryDays: 90,
        stpAllowNegative: 'ALLOW',
        stpIssueStrategy: 'FEFO',
        stpRemarks: `${DERIVED_FROM_ITEM_REMARK} [preset PHARMA]`,
        stpCreatedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('stpItemId');
      expect(data).not.toHaveProperty('stpGroupId');
      expect(data).not.toHaveProperty('stpTrackSignature');
      // A derived policy has always been in force.
      expect(data).not.toHaveProperty('stpEffectiveFrom');
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    // Notes 68: an item follows its group unless it names its own preset. The
    // item's flags used to derive a row that outranked the group's.
    it('writes no ITEM row for an item with no preset — its group governs', async () => {
      const result = await service.syncFromItem(item(), tx());

      expect(result).toMatchObject({ outcome: 'no_preset', stp_id: null });
      expect(client.stockTrackPreset.findUnique).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
    });

    it('retires the derived row of an item that no longer names a preset', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(pharmaRow());

      const result = await service.syncFromItem(item(), tx());

      expect(result.outcome).toBe('cleared');
      expect(client.stockTrackPolicy.update.mock.calls[0][0].data).toMatchObject({
        stpIsActive: false,
        stpIsDeleted: true,
      });
    });

    it('retires a pre-preset row derived from the item flags, which carries the bare marker', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({
          stpTrackMrp: true,
          stpTrackSignature: 'M',
          stpRemarks: DERIVED_FROM_ITEM_REMARK,
        }),
      );

      const result = await service.syncFromItem(item(), tx());

      expect(result.outcome).toBe('cleared');
    });

    it('treats a preset id that names nothing as no preset', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(null);

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.outcome).toBe('no_preset');
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
    });

    it('leaves an admin-authored policy alone, preset or not', async () => {
      for (const source of [item(), withPreset()]) {
        client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
          policyRow({
            stpRemarks: 'Set by hand for the pharmacy counter',
            stpIssueStrategy: 'MANUAL',
          }),
        );
        client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

        const result = await service.syncFromItem(source, tx());

        expect(result.outcome).toBe('skipped_manual');
      }
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('writes nothing when the derived row already says exactly this', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(pharmaRow());
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.outcome).toBe('unchanged');
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('updates the derived row when the preset now says something else', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(pharmaRow());
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset({ sptNearExpiryDays: 60 }));

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stpId: 'stp1' },
          data: expect.objectContaining({ stpNearExpiryDays: 60, stpModifiedBy: USER_ID }),
        }),
      );
    });

    it('retargets the existing derived row when the item moves branch', async () => {
      const otherBranch = '01000000-0000-7000-8000-0000000000b2';
      client.stockTrackPolicy.findFirst
        // nothing at the item's NEW (company, branch) slot ...
        .mockResolvedValueOnce(null)
        // ... but the derived row it left behind at the old one.
        .mockResolvedValueOnce(pharmaRow({ stpBranchId: otherBranch }));
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stpBranchId: BRANCH_ID }),
        }),
      );
    });

    it('honours a preset that has since been deactivated, rather than silently untracking the item', async () => {
      // Retiring a preset stops it being OFFERED. An item already configured
      // with it must keep resolving to it — dropping it here would untrack an
      // item whose stock is already keyed by batch and expiry.
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(
        preset({ sptIsActive: false, sptIsDeleted: true }),
      );

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.preset_code).toBe('PHARMA');
      expect(client.stockTrackPreset.findUnique).toHaveBeenCalledWith({
        where: { sptId: PRESET_ID },
      });
      expect(client.stockTrackPolicy.create.mock.calls[0][0].data).toMatchObject({
        stpTrackBatch: true,
        stpTrackSupplier: true,
      });
    });

    it('rewrites the remark when the preset changes but its values do not', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({ stpRemarks: `${DERIVED_FROM_ITEM_REMARK} [preset FMCG_MRP]` }),
      );
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(
        // Same thirteen values as the untracked policyRow default, different code.
        preset({
          sptCode: 'NONE',
          sptTrackBatch: false,
          sptTrackMrp: false,
          sptTrackExpiry: false,
          sptTrackSupplier: false,
          sptIssueStrategy: 'FIFO',
          sptNearExpiryDays: 30,
          sptBlockExpiredSale: false,
        }),
      );

      const result = await service.syncFromItem(withPreset(), tx());

      // Provenance is only recorded on the row, so a changed preset is a change
      // even when every value it supplies is identical.
      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.update.mock.calls[0][0].data.stpRemarks).toBe(
        `${DERIVED_FROM_ITEM_REMARK} [preset NONE]`,
      );
    });

    it('writes the NONE preset: an untracked preset is a deliberate item-level choice', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(
        preset({
          sptCode: 'NONE',
          sptTrackBatch: false,
          sptTrackMrp: false,
          sptTrackExpiry: false,
          sptTrackSupplier: false,
          sptAllowNegative: 'ALLOW',
        }),
      );

      const result = await service.syncFromItem(withPreset(), tx());

      expect(result.outcome).toBe('created');
      expect(client.stockTrackPolicy.create.mock.calls[0][0].data.stpRemarks).toBe(
        `${DERIVED_FROM_ITEM_REMARK} [preset NONE]`,
      );
    });
  });

  describe('retireForItem', () => {
    // Notes 50 #8: a deleted item's policy stayed live.
    it('retires every derived row of a deleted item, and only the derived ones', async () => {
      client.stockTrackPolicy.findMany.mockResolvedValueOnce([
        policyRow({ stpId: 'stp1' }),
        policyRow({ stpId: 'stp2', stpRemarks: `${DERIVED_FROM_ITEM_REMARK} [preset PHARMA]` }),
      ]);

      const results = await service.retireForItem(ITEM_ID, tx());

      expect(client.stockTrackPolicy.findMany.mock.calls[0][0].where).toMatchObject({
        stpScope: 'ITEM',
        stpItemId: ITEM_ID,
        stpRemarks: { startsWith: DERIVED_FROM_ITEM_REMARK },
        stpIsDeleted: false,
      });
      expect(results.map((r) => r.outcome)).toEqual(['cleared', 'cleared']);
      expect(client.stockTrackPolicy.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncFromItemGroup', () => {
    it('writes nothing at all when the group names no preset', async () => {
      const result = await service.syncFromItemGroup(group(), tx());

      // An all-false GROUP row would shadow the company-wide policy for every
      // item in the group, so "no preset" must mean no row, not a default one.
      expect(result).toMatchObject({ outcome: 'no_preset', stp_id: null, scope: 'GROUP' });
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    // Notes 69: filed under the LOGIN token's company, the row was invisible
    // to every other company's items. A group is not company-owned.
    it('creates the GROUP row SHARED by every company — never at the login company — and open to every branch', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      expect(result).toMatchObject({ outcome: 'created', scope: 'GROUP', preset_code: 'PHARMA' });
      expect(client.stockTrackPolicy.findFirst.mock.calls[0][0].where).toMatchObject({
        stpCompanyId: null,
        stpBranchId: null,
      });
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpScope: 'GROUP',
        stpScopeId: GROUP_ID,
        stpCompanyId: null,
        // A group rule sits above the branches, not inside one.
        stpBranchId: null,
        stpTrackSupplier: true,
        stpRemarks: `${DERIVED_FROM_GROUP_REMARK} [preset PHARMA]`,
      });
      expect(data).not.toHaveProperty('stpGroupId');
      expect(data).not.toHaveProperty('stpTrackSignature');
    });

    it('retires the derived row when the preset is cleared', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({
          stpScope: 'GROUP',
          stpScopeId: GROUP_ID,
          stpItemId: null,
          stpGroupId: GROUP_ID,
          stpBranchId: null,
          stpRemarks: `${DERIVED_FROM_GROUP_REMARK} [preset PHARMA]`,
        }),
      );

      const result = await service.syncFromItemGroup(group(), tx());

      expect(result.outcome).toBe('cleared');
      // Deactivated as well as soft-deleted: ex_stp_overlap and ix_stp_resolve
      // are both partial on active AND NOT deleted, so this frees the slot.
      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stpId: 'stp1' },
          data: expect.objectContaining({ stpIsActive: false, stpIsDeleted: true }),
        }),
      );
    });

    it('leaves an admin-authored GROUP policy alone, even when a preset is set', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({
          stpScope: 'GROUP',
          stpGroupId: GROUP_ID,
          stpRemarks: 'Authored by the stock controller',
        }),
      );
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      expect(result.outcome).toBe('skipped_manual');
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
    });

    it('revives a previously retired row rather than colliding with it', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(null);
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      // The retired row is invisible to the slot lookup (stpIsDeleted: false),
      // so this is a create — and createDerived leaves is_active/is_deleted at
      // their defaults rather than resurrecting anything by accident.
      expect(client.stockTrackPolicy.create).toHaveBeenCalledTimes(1);
    });
    const groupRow = (overrides: Partial<StockTrackPolicy> = {}) =>
      policyRow({
        stpScope: 'GROUP',
        stpScopeId: GROUP_ID,
        stpItemId: null,
        stpGroupId: GROUP_ID,
        stpBranchId: null,
        stpRemarks: `${DERIVED_FROM_GROUP_REMARK} [preset PHARMA]`,
        ...overrides,
      });

    it('moves a derived row stranded under a login company into the shared slot, and retires the others', async () => {
      const otherCompany = '01000000-0000-7000-8000-0000000000c2';
      client.stockTrackPolicy.findMany.mockResolvedValueOnce([
        groupRow({ stpId: 'stp-login-1', stpCompanyId: COMPANY_ID }),
        groupRow({ stpId: 'stp-login-2', stpCompanyId: otherCompany }),
      ]);
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      expect(client.stockTrackPolicy.findMany.mock.calls[0][0].where).toMatchObject({
        stpScope: 'GROUP',
        stpGroupId: GROUP_ID,
        stpCompanyId: { not: null },
        stpRemarks: { startsWith: DERIVED_FROM_GROUP_REMARK },
      });
      const updates = client.stockTrackPolicy.update.mock.calls.map(
        (call: [{ where: { stpId: string }; data: Record<string, unknown> }]) => call[0],
      );
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: { stpId: 'stp-login-2' },
            data: expect.objectContaining({ stpIsDeleted: true }),
          }),
          expect.objectContaining({
            where: { stpId: 'stp-login-1' },
            data: expect.objectContaining({ stpCompanyId: null, stpBranchId: null }),
          }),
        ]),
      );
      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
    });

    it('retires every stranded row when the shared slot is already held', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(groupRow());
      client.stockTrackPolicy.findMany.mockResolvedValueOnce([
        groupRow({ stpId: 'stp-login', stpCompanyId: COMPANY_ID }),
      ]);
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stpId: 'stp-login' },
          data: expect.objectContaining({ stpIsActive: false, stpIsDeleted: true }),
        }),
      );
    });
  });
});

describe('valuationMethodFor (notes 92)', () => {
  const none = {
    trackBatch: false,
    trackMrp: false,
    trackSalePrice: false,
    trackExpiry: false,
    trackSerial: false,
    trackSupplier: false,
  };
  it('a policy that tracks nothing is WAVG — plain stock keeps the branch average', () => {
    expect(valuationMethodFor(none)).toBe('WAVG');
  });
  it.each([
    'trackBatch',
    'trackMrp',
    'trackSalePrice',
    'trackExpiry',
    'trackSerial',
    'trackSupplier',
  ] as const)(
    'a policy that tracks %s alone is LOT_ACTUAL — every tracked item is costed per lot',
    (flag) => {
      expect(valuationMethodFor({ ...none, [flag]: true })).toBe('LOT_ACTUAL');
    },
  );
  it('presetToDerived takes the method from the flags, never from the preset row', () => {
    const service = new StockTrackPolicyService(
      {} as unknown as PrismaService,
      {} as unknown as AuditLogService,
      {} as unknown as RequestContextService,
    );
    // PHARMA tracks four dimensions: LOT_ACTUAL whatever its row says.
    expect(service.presetToDerived(preset({ sptValuationMethod: 'WAVG' })).valuationMethod).toBe(
      'LOT_ACTUAL',
    );
    // NONE tracks nothing: WAVG whatever its row says.
    expect(
      service.presetToDerived(
        preset({
          sptCode: 'NONE',
          sptTrackBatch: false,
          sptTrackMrp: false,
          sptTrackExpiry: false,
          sptTrackSupplier: false,
          sptValuationMethod: 'LOT_ACTUAL',
        }),
      ).valuationMethod,
    ).toBe('WAVG');
  });
});
