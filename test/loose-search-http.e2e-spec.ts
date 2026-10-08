import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * Loose search over HTTP: a stored name with a space in it ("CHILLI POWDER")
 * is found when typed without the space ("chillipowder"), with its words in
 * the other order, and with punctuation dropped — through the configured
 * DROPDOWN runner (every picker) and the configured GRID runner (every master
 * list). Read-only; the item it searches for is whatever live item has a
 * space in its name, so it holds on any database.
 *
 *     npm run test:e2e -- loose-search-http
 */

const BEARER = 'Bearer dummy-test-token';
const prisma = new PrismaClient();
// fixed.dropdown_details 42 "ITEMS": item_id, item_code, item_name_en of the live items.
const ITEMS_DROPDOWN_ID = 42;

type Row = Record<string, unknown>;

describe('Loose search (HTTP — read-only)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let itemId: string;
  let itemName: string;
  let itemGridId: string | undefined;

  beforeAll(async () => {
    const [company] = await prisma.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE NOT comp_is_deleted ORDER BY comp_name LIMIT 1`;
    const [user] = await prisma.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE NOT usr_is_deleted LIMIT 1`;
    // A live item whose name has an inner space and no digit, so the test can
    // type it squashed together: the shortest such name makes the search specific.
    const [item] = await prisma.$queryRaw<Array<{ item_id: string; item_name_en: string }>>`
      SELECT item_id, item_name_en FROM inventory.item_master
       WHERE item_is_active AND NOT item_is_deleted
         AND item_name_en ~ '^[A-Za-z]+ [A-Za-z]+$'
       ORDER BY length(item_name_en), item_name_en LIMIT 1`;
    itemId = item.item_id;
    itemName = item.item_name_en;
    // The item master list both clients read (grid 67 on dev); its SQL binds the
    // `iitem_is_deleted` token, which the clients always send in grid_param.
    const [grid] = await prisma.$queryRaw<Array<{ grid_id: bigint }>>`
      SELECT g.grid_id FROM fixed.grid_details g
       WHERE NOT g.grid_is_deleted AND g.grid_status AND g.grid_name = 'MAIN LIST - ITEMS'
       ORDER BY g.grid_id LIMIT 1`;
    itemGridId = grid ? String(grid.grid_id) : undefined;

    const claims: AccessTokenPayload = {
      sub: user.usr_id,
      user_name: 'e2e-loose-search',
      sid: 'e2e-loose-search-session',
      user_type: 'SUPER ADMIN',
      company_id: company.comp_id,
      branch_id: null as unknown as string,
      device_id: null as unknown as string,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const idsOf = (body: { data?: { items?: Row[] } }): string[] =>
    (body.data?.items ?? []).map((row) => String(row.item_id));

  const runDropdown = async (search: string): Promise<string[]> => {
    const res = await http
      .get('/api/v1/dropdown-details/run')
      .set('Authorization', BEARER)
      .query({ dropdown_id: ITEMS_DROPDOWN_ID, page: 1, limit: 50, search });
    expect(res.status).toBe(200);
    return idsOf(res.body);
  };

  it('the dropdown runner finds a two-word name typed without its space', async () => {
    const squashed = itemName.replace(/\s+/g, '').toLowerCase(); // "chillipowder"
    expect(await runDropdown(squashed)).toContain(itemId);
  });

  it('…and with its words in the other order, and with stray punctuation', async () => {
    const [first, second] = itemName.split(/\s+/);
    expect(await runDropdown(`${second} ${first}`)).toContain(itemId);
    expect(await runDropdown(`${first}-${second}.`)).toContain(itemId);
  });

  it('still finds the name typed as stored, and misses a word it does not have', async () => {
    expect(await runDropdown(itemName)).toContain(itemId);
    expect(await runDropdown(`${itemName} zzqxv`)).not.toContain(itemId);
  });

  it('the grid runner applies the same rule to a master list', async () => {
    if (!itemGridId) {
      return; // no "MAIN LIST - ITEMS" grid on this database
    }
    const squashed = itemName.replace(/\s+/g, '').toUpperCase();
    const res = await http
      .get('/api/v1/configured-grid-sql/run')
      .set('Authorization', BEARER)
      .query({
        grid_id: itemGridId,
        page: 1,
        limit: 50,
        search: squashed,
        grid_param: JSON.stringify({ iitem_is_deleted: false }),
      });
    expect(res.status).toBe(200);
    expect(idsOf(res.body)).toContain(itemId);
  });
});
