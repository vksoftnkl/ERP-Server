import { Prisma, StockTrackPolicy } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DERIVED_FROM_ITEM_REMARK, StockTrackPolicyService } from './stock-track-policy.service';
import { ItemTrackPolicySource } from './types/stock-track-policy.types';

const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';

const item = (overrides: Partial<ItemTrackPolicySource> = {}): ItemTrackPolicySource => ({
  itemId: ITEM_ID,
  itemCompanyId: COMPANY_ID,
  itemBranchId: BRANCH_ID,
  itemBatchConfig: 0,
  itemIsBatchBased: false,
  itemIsExpiryItem: false,
  itemExpiryDays: null,
  itemIntimateBeforeDays: null,
  itemAllowNegStock: true,
  ...overrides,
});

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
    };
    auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new StockTrackPolicyService(
      client as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
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
  });
});
