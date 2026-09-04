import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

/**
 * "Does THIS customer earn on THIS scheme?"
 *
 * The ordering rule is the whole point and is not visible to the compiler, so
 * it is pinned here: highest lsp_match_priority wins, and at equal priority an
 * EXCLUDE beats an INCLUDE.
 *
 * Loyalty has only two kinds — CUSTOMER and CUSTOMER_GROUP — because a wallet
 * follows the person, not the route.
 */
type PartyRow = {
  lspId: string;
  lspKind: string;
  lspIsExclude: boolean;
  lspMatchPriority: number;
};

const CUS_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const LSC_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5f';

/** Sorts the candidate rows the way the service asks Postgres to sort them. */
const orderLikePostgres = (rows: PartyRow[]): PartyRow[] =>
  [...rows].sort(
    (a, b) =>
      b.lspMatchPriority - a.lspMatchPriority || Number(b.lspIsExclude) - Number(a.lspIsExclude),
  );

const buildService = (opts: {
  custScope?: string;
  parties?: PartyRow[];
  customer?: unknown;
}): PromotionLoyaltyPointsService => {
  const rows = opts.parties ?? [];
  const prisma = {
    loyaltyScheme: {
      findFirst: jest.fn().mockResolvedValue({
        lscId: LSC_ID,
        lscCustScope: opts.custScope ?? 'LIST',
      }),
    },
    customer: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.customer === undefined ? { cusId: CUS_ID, cusGroupId: 'group-1' } : opts.customer,
        ),
    },
    loyaltySchemeParty: {
      findFirst: jest.fn().mockResolvedValue(orderLikePostgres(rows)[0] ?? null),
    },
  };

  return new PromotionLoyaltyPointsService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => null } as never,
  );
};

describe('PromotionLoyaltyPointsService.checkEligibility', () => {
  it('answers YES without reading a party row when the scheme covers everyone', async () => {
    const service = buildService({ custScope: 'ALL' });

    const result = await service.checkEligibility(LSC_ID, CUS_ID);

    expect(result.qualifies).toBe(true);
    expect(result.decided_by).toBe('ALL');
    expect(result.matched_by).toBeNull();
  });

  it('answers NO when the scheme is a LIST that no row reaches', async () => {
    const service = buildService({ parties: [] });

    const result = await service.checkEligibility(LSC_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.decided_by).toBe('NO_RULE');
  });

  it('lets a CUSTOMER_GROUP include through when nothing narrower contradicts it', async () => {
    const service = buildService({
      parties: [
        { lspId: 'r1', lspKind: 'CUSTOMER_GROUP', lspIsExclude: false, lspMatchPriority: 1 },
      ],
    });

    const result = await service.checkEligibility(LSC_ID, CUS_ID);

    expect(result.qualifies).toBe(true);
    expect(result.matched_by).toBe('CUSTOMER_GROUP');
    expect(result.reason).toBe('YES — via CUSTOMER_GROUP');
  });

  // The pair the design is for: the group rule lets the wholesalers in, the
  // narrower per-customer exclusion carves one of them back out.
  it('lets a narrower CUSTOMER exclude beat a broader CUSTOMER_GROUP include', async () => {
    const service = buildService({
      parties: [
        { lspId: 'r1', lspKind: 'CUSTOMER_GROUP', lspIsExclude: false, lspMatchPriority: 1 },
        { lspId: 'r2', lspKind: 'CUSTOMER', lspIsExclude: true, lspMatchPriority: 2 },
      ],
    });

    const result = await service.checkEligibility(LSC_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.matched_by).toBe('CUSTOMER');
    expect(result.reason).toBe('NO — carved out by the CUSTOMER rule');
  });

  it('lets an EXCLUDE beat an INCLUDE of equal specificity', async () => {
    const service = buildService({
      parties: [
        { lspId: 'r1', lspKind: 'CUSTOMER', lspIsExclude: false, lspMatchPriority: 2 },
        { lspId: 'r2', lspKind: 'CUSTOMER', lspIsExclude: true, lspMatchPriority: 2 },
      ],
    });

    const result = await service.checkEligibility(LSC_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.matched_row_id).toBe('r2');
  });

  it('404s on an unknown customer', async () => {
    const service = buildService({ customer: null });

    await expect(service.checkEligibility(LSC_ID, CUS_ID)).rejects.toThrow();
  });
});
