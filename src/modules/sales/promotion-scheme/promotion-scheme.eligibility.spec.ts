import { PromotionSchemeService } from './promotion-scheme.service';

/**
 * §3 of 15q_promotion_scope_queries.sql — "does THIS customer qualify?".
 *
 * The ordering rule is the whole point and is not visible to the compiler, so
 * it is pinned here: highest prp_match_priority wins, and at equal priority an
 * EXCLUDE beats an INCLUDE.
 */
type PartyRow = {
  prpId: string;
  prpKind: string;
  prpIsExclude: boolean;
  prpMatchPriority: number;
};

const CUS_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const PRM_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5f';

/** Sorts the candidate rows the way the service asks Postgres to sort them. */
const orderLikePostgres = (rows: PartyRow[]): PartyRow[] =>
  [...rows].sort(
    (a, b) =>
      b.prpMatchPriority - a.prpMatchPriority || Number(b.prpIsExclude) - Number(a.prpIsExclude),
  );

const buildService = (opts: {
  custScope?: string;
  parties?: PartyRow[];
  customer?: unknown;
}): PromotionSchemeService => {
  const rows = opts.parties ?? [];
  const prisma = {
    promotionScheme: {
      findFirst: jest.fn().mockResolvedValue({
        prmId: PRM_ID,
        prmCustScope: opts.custScope ?? 'LIST',
      }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(
        opts.customer === undefined
          ? {
              cusId: CUS_ID,
              cusGroupId: 'group-1',
              cusAreaId: 'area-1',
              area: { armCityId: 'city-1' },
            }
          : opts.customer,
      ),
    },
    promotionSchemeParty: {
      findFirst: jest.fn().mockResolvedValue(orderLikePostgres(rows)[0] ?? null),
    },
  };

  return new PromotionSchemeService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => null } as never,
  );
};

describe('PromotionSchemeService.checkEligibility', () => {
  it('answers YES without reading a party row when the scheme covers everyone', async () => {
    const service = buildService({ custScope: 'ALL' });

    const result = await service.checkEligibility(PRM_ID, CUS_ID);

    expect(result.qualifies).toBe(true);
    expect(result.decided_by).toBe('ALL');
    expect(result.matched_by).toBeNull();
  });

  it('answers NO when the scheme is a LIST that no row reaches', async () => {
    const service = buildService({ parties: [] });

    const result = await service.checkEligibility(PRM_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.decided_by).toBe('NO_RULE');
  });

  it('lets a CITY include through when nothing narrower contradicts it', async () => {
    const service = buildService({
      parties: [{ prpId: 'r1', prpKind: 'CITY', prpIsExclude: false, prpMatchPriority: 2 }],
    });

    const result = await service.checkEligibility(PRM_ID, CUS_ID);

    expect(result.qualifies).toBe(true);
    expect(result.matched_by).toBe('CITY');
    expect(result.reason).toBe('YES — via CITY');
  });

  // The pair from the SQL doc: the CITY rule lets the town in, the narrower
  // AREA exclusion carves one route back out.
  it('lets a narrower AREA exclude beat a broader CITY include', async () => {
    const service = buildService({
      parties: [
        { prpId: 'r1', prpKind: 'CITY', prpIsExclude: false, prpMatchPriority: 2 },
        { prpId: 'r2', prpKind: 'AREA', prpIsExclude: true, prpMatchPriority: 3 },
      ],
    });

    const result = await service.checkEligibility(PRM_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.matched_by).toBe('AREA');
    expect(result.reason).toBe('NO — carved out by the AREA rule');
  });

  it('lets an EXCLUDE beat an INCLUDE of equal specificity', async () => {
    const service = buildService({
      parties: [
        { prpId: 'r1', prpKind: 'AREA', prpIsExclude: false, prpMatchPriority: 3 },
        { prpId: 'r2', prpKind: 'AREA', prpIsExclude: true, prpMatchPriority: 3 },
      ],
    });

    const result = await service.checkEligibility(PRM_ID, CUS_ID);

    expect(result.qualifies).toBe(false);
    expect(result.matched_row_id).toBe('r2');
  });

  it('404s on an unknown customer', async () => {
    const service = buildService({ customer: null });

    await expect(service.checkEligibility(PRM_ID, CUS_ID)).rejects.toThrow();
  });
});
