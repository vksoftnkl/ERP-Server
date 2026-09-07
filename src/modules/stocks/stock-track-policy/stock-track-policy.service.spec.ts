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
  itemBatchConfig: 0,
  itemIsBatchBased: false,
  itemIsExpiryItem: false,
  itemExpiryDays: null,
  itemIntimateBeforeDays: null,
  itemAllowNegStock: true,
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
const preset = (overrides: Partial<StockTrackPreset> = {}): StockTrackPreset =>
  ({
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
    sptValuationMethod: 'WAVG',
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
  }) as StockTrackPreset;

const policyRow = (overrides: Partial<StockTrackPolicy> = {}): StockTrackPolicy =>
  ({
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
  }) as StockTrackPolicy;

describe('StockTrackPolicyService', () => {
  let service: StockTrackPolicyService;
  let client: {
    stockTrackPolicy: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    stockTrackPreset: { findUnique: jest.Mock };
  };
  let auditLogService: { logEntityChange: jest.Mock };

  const tx = () => client as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    client = {
      stockTrackPolicy: {
        findFirst: jest.fn().mockResolvedValue(null),
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

  describe('deriveFromItem', () => {
    it('reads a plain item as untracked, FIFO, negative-stock allowed', () => {
      expect(service.deriveFromItem(item())).toMatchObject({
        trackBatch: false,
        trackMrp: false,
        trackExpiry: false,
        issueStrategy: 'FIFO',
        allowNegative: 'ALLOW',
        valuationMethod: 'WAVG',
        shelfLifeDays: null,
        nearExpiryDays: 30,
      });
    });

    it('reads item_batch_config 1 as MRP-wise and 2 as batch-wise', () => {
      expect(service.deriveFromItem(item({ itemBatchConfig: 1 }))).toMatchObject({
        trackMrp: true,
        trackBatch: false,
      });
      expect(service.deriveFromItem(item({ itemBatchConfig: 2 }))).toMatchObject({
        trackMrp: false,
        trackBatch: true,
      });
    });

    it('forces batch tracking on an expiry item, and switches it to FEFO', () => {
      expect(service.deriveFromItem(item({ itemIsExpiryItem: true }))).toMatchObject({
        trackExpiry: true,
        // ck_stp_expiry_needs_batch — expiry cannot be keyed without it.
        trackBatch: true,
        issueStrategy: 'FEFO',
      });
    });

    it('keeps mrp and batch together for an MRP item that also expires', () => {
      const derived = service.deriveFromItem(
        item({ itemBatchConfig: 1, itemIsExpiryItem: true }),
      );
      expect(derived).toMatchObject({ trackMrp: true, trackBatch: true, trackExpiry: true });
    });

    it('blocks negative stock when the item disallows it', () => {
      expect(service.deriveFromItem(item({ itemAllowNegStock: false }))).toMatchObject({
        allowNegative: 'BLOCK',
      });
    });

    it('drops a non-positive shelf life and a negative near-expiry window', () => {
      // ck_stp_shelf_life (NULL or > 0) and ck_stp_near_expiry (>= 0).
      expect(
        service.deriveFromItem(item({ itemExpiryDays: 0, itemIntimateBeforeDays: -5 })),
      ).toMatchObject({ shelfLifeDays: null, nearExpiryDays: 30 });
      expect(
        service.deriveFromItem(item({ itemExpiryDays: 180, itemIntimateBeforeDays: 0 })),
      ).toMatchObject({ shelfLifeDays: 180, nearExpiryDays: 0 });
    });
  });

  describe('syncFromItem', () => {
    it('creates the ITEM-scope row, writing the scope pair and never the generated columns', async () => {
      const result = await service.syncFromItem(item({ itemIsExpiryItem: true }), tx());

      expect(result.outcome).toBe('created');
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpScope: 'ITEM',
        stpScopeId: ITEM_ID,
        stpCompanyId: COMPANY_ID,
        stpBranchId: BRANCH_ID,
        stpTrackExpiry: true,
        stpIssueStrategy: 'FEFO',
        stpRemarks: DERIVED_FROM_ITEM_REMARK,
        stpCreatedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('stpItemId');
      expect(data).not.toHaveProperty('stpGroupId');
      expect(data).not.toHaveProperty('stpTrackSignature');
      // A derived policy has always been in force.
      expect(data).not.toHaveProperty('stpEffectiveFrom');
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('leaves an admin-authored policy alone', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({ stpRemarks: 'Set by hand for the pharmacy counter', stpIssueStrategy: 'MANUAL' }),
      );

      const result = await service.syncFromItem(item({ itemIsExpiryItem: true }), tx());

      expect(result.outcome).toBe('skipped_manual');
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('writes nothing when the derived row already says exactly this', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(policyRow());

      const result = await service.syncFromItem(item(), tx());

      expect(result.outcome).toBe('unchanged');
      expect(client.stockTrackPolicy.update).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('updates the derived row when an item flag changed', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(policyRow());

      const result = await service.syncFromItem(item({ itemIsBatchBased: true }), tx());

      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stpId: 'stp1' },
          data: expect.objectContaining({ stpTrackBatch: true, stpModifiedBy: USER_ID }),
        }),
      );
    });

    it('retargets the existing derived row when the item moves branch', async () => {
      const otherBranch = '01000000-0000-7000-8000-0000000000b2';
      client.stockTrackPolicy.findFirst
        // nothing at the item's NEW (company, branch) slot ...
        .mockResolvedValueOnce(null)
        // ... but the derived row it left behind at the old one.
        .mockResolvedValueOnce(policyRow({ stpBranchId: otherBranch }));

      const result = await service.syncFromItem(item(), tx());

      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
      expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stpBranchId: BRANCH_ID }),
        }),
      );
    });

    it('takes every column from the preset, ignoring the item flags entirely', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      // Flags that on their own would derive B/FEFO/BLOCK and a 7-day window.
      const result = await service.syncFromItem(
        item({
          itemTrackPresetId: PRESET_ID,
          itemIsBatchBased: true,
          itemAllowNegStock: false,
          itemIntimateBeforeDays: 7,
        }),
        tx(),
      );

      expect(result.outcome).toBe('created');
      expect(result.preset_code).toBe('PHARMA');
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpTrackBatch: true,
        stpTrackMrp: true,
        stpTrackExpiry: true,
        // Only a preset can set these three; no item_master column expresses them.
        stpTrackSupplier: true,
        stpTrackSalePrice: false,
        stpTrackSerial: false,
        stpBlockExpiredSale: true,
        // The preset's window and negative-stock rule, not the item's.
        stpNearExpiryDays: 90,
        stpAllowNegative: 'ALLOW',
        stpRemarks: `${DERIVED_FROM_ITEM_REMARK} [preset PHARMA]`,
      });
    });

    it('falls back to the item flags when the preset id names nothing', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(null);

      const result = await service.syncFromItem(
        item({ itemTrackPresetId: PRESET_ID, itemIsExpiryItem: true }),
        tx(),
      );

      expect(result.outcome).toBe('created');
      expect(result.preset_code).toBeNull();
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpTrackExpiry: true,
        stpTrackSupplier: false,
        stpNearExpiryDays: 30,
        stpRemarks: DERIVED_FROM_ITEM_REMARK,
      });
    });

    it('honours a preset that has since been deactivated, rather than silently untracking the item', async () => {
      // Retiring a preset stops it being OFFERED. An item already configured
      // with it must keep resolving to it — falling back here would drop batch
      // and expiry from an item whose stock is already keyed by them.
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(
        preset({ sptIsActive: false, sptIsDeleted: true }),
      );

      const result = await service.syncFromItem(item({ itemTrackPresetId: PRESET_ID }), tx());

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

      const result = await service.syncFromItem(item({ itemTrackPresetId: PRESET_ID }), tx());

      // Provenance is only recorded on the row, so a changed preset is a change
      // even when every value it supplies is identical.
      expect(result.outcome).toBe('updated');
      expect(client.stockTrackPolicy.update.mock.calls[0][0].data.stpRemarks).toBe(
        `${DERIVED_FROM_ITEM_REMARK} [preset NONE]`,
      );
    });

    it('still recognises a pre-preset derived row, which carries the bare marker', async () => {
      client.stockTrackPolicy.findFirst.mockResolvedValueOnce(
        policyRow({ stpRemarks: DERIVED_FROM_ITEM_REMARK }),
      );

      const result = await service.syncFromItem(item({ itemIsBatchBased: true }), tx());

      expect(result.outcome).toBe('updated');
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

    it('creates the GROUP row at the context company, open to every branch', async () => {
      client.stockTrackPreset.findUnique.mockResolvedValueOnce(preset());

      const result = await service.syncFromItemGroup(group({ itgTrackPresetId: PRESET_ID }), tx());

      expect(result).toMatchObject({ outcome: 'created', scope: 'GROUP', preset_code: 'PHARMA' });
      const { data } = client.stockTrackPolicy.create.mock.calls[0][0];
      expect(data).toMatchObject({
        stpScope: 'GROUP',
        stpScopeId: GROUP_ID,
        stpCompanyId: COMPANY_ID,
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
  });
});
