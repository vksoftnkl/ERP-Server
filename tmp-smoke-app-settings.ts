/* Integration smoke test for the app-settings module: boots the real Nest
 * application context, drives both services against the live DB, then removes
 * everything it created. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AppSettingDefService } from './src/modules/settings/appSettings/app-setting-def.service';
import { AppSettingValueService } from './src/modules/settings/appSettings/app-setting-value.service';
import { PrismaService } from './src/database/prisma/prisma.service';

const KEY = 'zztest.smoke_percent';
const KEY_ENUM = 'zztest.smoke_mode';

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean, extra?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`, extra ?? '');
  }
}
async function expectError(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    fail += 1;
    console.log(`  FAIL ${label} — no error thrown`);
  } catch (error: any) {
    pass += 1;
    const body = error?.response ?? error?.message;
    console.log(`  ok   ${label}: ${JSON.stringify(body?.errors?.[0]?.message ?? body)}`);
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const defs = app.get(AppSettingDefService);
  const values = app.get(AppSettingValueService);
  const prisma = app.get(PrismaService);

  const company = await prisma.company.findFirst({ select: { compId: true } });
  const branch = await prisma.branchMaster.findFirst({ select: { brId: true } });
  const user = await prisma.userMaster.findFirst({ select: { usrId: true } });
  const device = await prisma.deviceMaster.findFirst({ select: { devId: true } });
  console.log('scope:', { company, branch, user, device });

  try {
    console.log('\n1. catalog create');
    const def = await defs.save({
      asdKey: KEY,
      asdModule: 'zztest',
      asdGroup: 'Smoke',
      asdDataType: 'DECIMAL' as any,
      asdDefaultValue: '10',
      asdMinValue: 0,
      asdMaxValue: 100,
      asdMaxScope: 'USER' as any,
      asdLabel: 'Smoke percent',
    });
    check('created with an id', Boolean(def.asdId), def);
    check('defaults applied', def.asdGroup === 'Smoke' && def.asdIsActive === true, def);

    const enumDef = await defs.save({
      asdKey: KEY_ENUM,
      asdModule: 'zztest',
      asdDataType: 'TEXT' as any,
      asdDefaultValue: 'WARN',
      asdAllowedValues: ['OFF', 'WARN', 'BLOCK'],
      asdMaxScope: 'BRANCH' as any,
      asdLabel: 'Smoke mode',
    });
    check('allowed values stored', JSON.stringify(enumDef.asdAllowedValues) === '["OFF","WARN","BLOCK"]', enumDef);

    console.log('\n2. catalog validation');
    await expectError('bad key shape refused', () =>
      defs.save({ asdKey: 'NoDots', asdModule: 'zztest', asdDataType: 'BOOL' as any, asdLabel: 'x' }),
    );
    await expectError('duplicate key refused', () =>
      defs.save({ asdKey: KEY, asdModule: 'zztest', asdDataType: 'BOOL' as any, asdLabel: 'x' }),
    );
    await expectError('uncastable default refused', () =>
      defs.save({
        asdKey: 'zztest.bad_default',
        asdModule: 'zztest',
        asdDataType: 'INT' as any,
        asdDefaultValue: 'abc',
        asdLabel: 'x',
      }),
    );
    await expectError('min > max refused', () =>
      defs.save({
        asdKey: 'zztest.bad_range',
        asdModule: 'zztest',
        asdDataType: 'INT' as any,
        asdMinValue: 10,
        asdMaxValue: 1,
        asdLabel: 'x',
      }),
    );
    await expectError('key rename refused', () =>
      defs.save({ asdId: def.asdId, asdKey: 'zztest.renamed' }),
    );

    console.log('\n3. catalog read');
    const byKey = await defs.getByKey(KEY);
    check('getByKey', byKey.asdId === def.asdId);
    const listed = await defs.list({ asdModule: 'zztest' });
    check('list filtered by module', listed.items.length === 2, listed.meta);

    console.log('\n4. overrides — layering');
    const globalRow = await values.save({ asvSettingKey: KEY, asvScope: 'GLOBAL' as any, asvValue: '20' });
    const companyRow = await values.save({
      asvSettingKey: KEY,
      asvScope: 'COMPANY' as any,
      asvCompanyId: company!.compId,
      asvValue: '30',
    });
    const branchRow = await values.save({
      asvSettingKey: KEY,
      asvScope: 'BRANCH' as any,
      asvBranchId: branch!.brId,
      asvValue: '40',
    });
    const userRow = await values.save({
      asvSettingKey: KEY,
      asvScope: 'USER' as any,
      asvUserId: user!.usrId,
      asvValue: '50',
    });
    const full = await values.resolve({
      companyId: company!.compId,
      branchId: branch!.brId,
      deviceId: device?.devId ?? null,
      userId: user!.usrId,
    });
    check('deepest layer wins (USER)', full[KEY] === 50, full[KEY]);
    check('resolved value is a number, not a string', typeof full[KEY] === 'number', typeof full[KEY]);
    const companyOnly = await values.resolve({ companyId: company!.compId });
    check('company-only caller sees COMPANY', companyOnly[KEY] === 30, companyOnly[KEY]);
    const anon = await values.resolve({});
    check('anonymous caller sees GLOBAL', anon[KEY] === 20, anon[KEY]);
    const one = await values.resolveOne(KEY, { companyId: company!.compId, branchId: branch!.brId });
    check('resolveOne returns raw text', one.value === '40', one);
    check('resolveOne on an unknown key is null', (await values.resolveOne('zztest.nope', {})).value === null);

    console.log('\n5. upsert, not duplicate');
    const again = await values.save({
      asvSettingKey: KEY,
      asvScope: 'COMPANY' as any,
      asvCompanyId: company!.compId,
      asvValue: '35',
    });
    check('same target upserts the same row', again.asvId === companyRow.asvId, {
      first: companyRow.asvId,
      second: again.asvId,
    });
    check('value moved', (await values.resolve({ companyId: company!.compId }))[KEY] === 35);

    console.log('\n6. override validation');
    await expectError('out-of-range value refused', () =>
      values.save({ asvSettingKey: KEY, asvScope: 'GLOBAL' as any, asvValue: '150' }),
    );
    await expectError('uncastable value refused', () =>
      values.save({ asvSettingKey: KEY, asvScope: 'GLOBAL' as any, asvValue: 'abc' }),
    );
    await expectError('value outside allowed list refused', () =>
      values.save({
        asvSettingKey: KEY_ENUM,
        asvScope: 'BRANCH' as any,
        asvBranchId: branch!.brId,
        asvValue: 'MAYBE',
      }),
    );
    await expectError('scope deeper than asdMaxScope refused', () =>
      values.save({ asvSettingKey: KEY_ENUM, asvScope: 'USER' as any, asvUserId: user!.usrId, asvValue: 'OFF' }),
    );
    await expectError('wrong id for the scope refused', () =>
      values.save({
        asvSettingKey: KEY,
        asvScope: 'BRANCH' as any,
        asvCompanyId: company!.compId,
        asvBranchId: branch!.brId,
        asvValue: '10',
      }),
    );
    await expectError('missing id for the scope refused', () =>
      values.save({ asvSettingKey: KEY, asvScope: 'BRANCH' as any, asvValue: '10' }),
    );
    await expectError('unknown setting key refused', () =>
      values.save({ asvSettingKey: 'zztest.nope', asvScope: 'GLOBAL' as any, asvValue: '1' }),
    );
    await expectError('non-existent target refused', () =>
      values.save({
        asvSettingKey: KEY,
        asvScope: 'COMPANY' as any,
        asvCompanyId: '00000000-0000-0000-0000-0000000000aa',
        asvValue: '10',
      }),
    );
    await expectError('retarget on update refused', () =>
      values.save({ asvId: companyRow.asvId, asvBranchId: branch!.brId }),
    );

    console.log('\n7. explicit null blanks the key');
    await values.save({ asvId: userRow.asvId, asvValue: null });
    const blanked = await values.resolve({
      companyId: company!.compId,
      branchId: branch!.brId,
      userId: user!.usrId,
    });
    check('null override omits the key', !(KEY in blanked), blanked[KEY]);

    console.log('\n8. reset');
    await values.softDelete(userRow.asvId);
    const afterReset = await values.resolve({
      companyId: company!.compId,
      branchId: branch!.brId,
      userId: user!.usrId,
    });
    check('reset falls back to BRANCH', afterReset[KEY] === 40, afterReset[KEY]);
    const reReset = await values.save({
      asvSettingKey: KEY,
      asvScope: 'USER' as any,
      asvUserId: user!.usrId,
      asvValue: '55',
    });
    check('slot is free again after a reset', reReset.asvId !== userRow.asvId);

    console.log('\n9. catalog guards against stored overrides');
    await expectError('narrowing asdMaxScope with deeper overrides refused', () =>
      defs.save({ asdId: def.asdId, asdMaxScope: 'COMPANY' as any }),
    );
    await expectError('type change that breaks stored values refused', () =>
      defs.save({ asdId: def.asdId, asdDataType: 'UUID' as any }),
    );
    await expectError('tightening max below a stored value refused', () =>
      defs.save({ asdId: def.asdId, asdMaxValue: 25 }),
    );
    await expectError('delete refused while overrides live', () => defs.softDelete(def.asdId));

    console.log('\n10. retire, then delete');
    const retired = await defs.save({ asdId: enumDef.asdId, asdIsActive: false });
    check('retired', retired.asdIsActive === false);
    check('retired setting leaves the resolver', !(KEY_ENUM in (await values.resolve({}))));
    await expectError('no new override on a retired setting', () =>
      values.save({ asvSettingKey: KEY_ENUM, asvScope: 'GLOBAL' as any, asvValue: 'OFF' }),
    );
    await defs.softDelete(enumDef.asdId);
    check('deleted def is gone from list', (await defs.list({ asdModule: 'zztest' })).items.length === 1);

    console.log('\n11. list of overrides');
    const overrides = await values.list({ asvSettingKey: KEY });
    check('lists live overrides only', overrides.items.length === 4, overrides.meta);
    const byModule = await values.list({ asdModule: 'zztest' });
    check('filters overrides by catalog module', byModule.items.length === 4, byModule.meta);
  } finally {
    console.log('\ncleanup');
    await prisma.appSettingValue.deleteMany({
      where: { asvSettingKey: { in: [KEY, KEY_ENUM] } },
    });
    const removed = await prisma.appSettingDef.deleteMany({ where: { asdModule: 'zztest' } });
    console.log(`  removed ${removed.count} test definitions`);
    await app.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
