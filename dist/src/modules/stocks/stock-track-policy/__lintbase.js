"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stock_track_policy_service_1 = require("./stock-track-policy.service");
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const item = (overrides = {}) => ({
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
const policyRow = (overrides = {}) => ({
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
    stpRemarks: stock_track_policy_service_1.DERIVED_FROM_ITEM_REMARK,
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
    let service;
    let client;
    let auditLogService;
    const tx = () => client;
    beforeEach(() => {
        client = {
            stockTrackPolicy: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn((args) => Promise.resolve(policyRow(args.data))),
                update: jest.fn((args) => Promise.resolve(policyRow(args.data))),
            },
        };
        auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
        service = new stock_track_policy_service_1.StockTrackPolicyService(client, auditLogService, { getUserId: () => USER_ID });
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
                trackBatch: true,
                issueStrategy: 'FEFO',
            });
        });
        it('keeps mrp and batch together for an MRP item that also expires', () => {
            const derived = service.deriveFromItem(item({ itemBatchConfig: 1, itemIsExpiryItem: true }));
            expect(derived).toMatchObject({ trackMrp: true, trackBatch: true, trackExpiry: true });
        });
        it('blocks negative stock when the item disallows it', () => {
            expect(service.deriveFromItem(item({ itemAllowNegStock: false }))).toMatchObject({
                allowNegative: 'BLOCK',
            });
        });
        it('drops a non-positive shelf life and a negative near-expiry window', () => {
            expect(service.deriveFromItem(item({ itemExpiryDays: 0, itemIntimateBeforeDays: -5 }))).toMatchObject({ shelfLifeDays: null, nearExpiryDays: 30 });
            expect(service.deriveFromItem(item({ itemExpiryDays: 180, itemIntimateBeforeDays: 0 }))).toMatchObject({ shelfLifeDays: 180, nearExpiryDays: 0 });
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
                stpRemarks: stock_track_policy_service_1.DERIVED_FROM_ITEM_REMARK,
                stpCreatedBy: USER_ID,
            });
            expect(data).not.toHaveProperty('stpItemId');
            expect(data).not.toHaveProperty('stpGroupId');
            expect(data).not.toHaveProperty('stpTrackSignature');
            expect(data).not.toHaveProperty('stpEffectiveFrom');
            expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
        });
        it('leaves an admin-authored policy alone', async () => {
            client.stockTrackPolicy.findFirst.mockResolvedValueOnce(policyRow({ stpRemarks: 'Set by hand for the pharmacy counter', stpIssueStrategy: 'MANUAL' }));
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
            expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { stpId: 'stp1' },
                data: expect.objectContaining({ stpTrackBatch: true, stpModifiedBy: USER_ID }),
            }));
        });
        it('retargets the existing derived row when the item moves branch', async () => {
            const otherBranch = '01000000-0000-7000-8000-0000000000b2';
            client.stockTrackPolicy.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(policyRow({ stpBranchId: otherBranch }));
            const result = await service.syncFromItem(item(), tx());
            expect(result.outcome).toBe('updated');
            expect(client.stockTrackPolicy.create).not.toHaveBeenCalled();
            expect(client.stockTrackPolicy.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ stpBranchId: BRANCH_ID }),
            }));
        });
    });
});
//# sourceMappingURL=__lintbase.js.map