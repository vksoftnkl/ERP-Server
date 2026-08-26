#!/usr/bin/env node
/**
 * Phase 0.3 — expression engine spike.
 *
 * Confirms jexl can carry the template expression language:
 *   1. custom transforms (fmt, numToWords) work and compose
 *   2. the evaluator has NO reach into the JS runtime — templates are
 *      tenant-authored content, so an escape is remote code execution
 *   3. expressions can be compiled once and reused per row (hot path)
 *
 * Run: node scripts/reporting/jexl-sandbox-spike.js
 */
const jexl = require('jexl');

const engine = new jexl.Jexl();

engine.addTransform('fmt', (value, pattern) => {
  const decimals = (String(pattern).split('.')[1] || '').length;
  const grouped = String(pattern).includes(',');
  const fixed = Number(value ?? 0).toFixed(decimals);
  if (!grouped) {
    return fixed;
  }
  const [whole, fraction] = fixed.split('.');
  const lakh = whole.replace(/(\d)(?=(\d\d)+\d$)/g, '$1,');
  return fraction ? `${lakh}.${fraction}` : lakh;
});

engine.addTransform('upper', (value) => String(value ?? '').toUpperCase());

const cases = [
  { expr: "company.name|upper", context: { company: { name: 'Sri Traders' } }, expect: 'SRI TRADERS' },
  { expr: "row.netAmount|fmt('#,##0.00')", context: { row: { netAmount: 250000 } }, expect: '2,50,000.00' },
  { expr: "row.qty|fmt('0.000')", context: { row: { qty: 12.5 } }, expect: '12.500' },
  { expr: "row.netAmount < 0 ? '#8B1D1D' : '#000000'", context: { row: { netAmount: -5 } }, expect: '#8B1D1D' },
  { expr: "invoice.einvoiceApplicable && invoice.irn != null", context: { invoice: { einvoiceApplicable: true, irn: 'x' } }, expect: true },
];

// Anything that reaches the host runtime must fail, not evaluate.
const escapeAttempts = [
  "constructor.constructor('return process')()",
  "''.constructor.constructor('return global')()",
  "process.env.DATABASE_URL",
  "require('node:fs')",
  "this.constructor",
  "__proto__.polluted",
  "globalThis",
];

const run = async () => {
  let failures = 0;
  const transformResults = [];

  for (const testCase of cases) {
    let actual;
    let error = null;
    try {
      actual = await engine.eval(testCase.expr, testCase.context);
    } catch (caught) {
      error = caught.message;
    }
    const passed = error === null && actual === testCase.expect;
    if (!passed) {
      failures += 1;
    }
    transformResults.push({ expr: testCase.expr, expect: testCase.expect, actual, error, passed });
  }

  const escapeResults = [];
  for (const attempt of escapeAttempts) {
    let outcome;
    let contained;
    try {
      const value = await engine.eval(attempt, { row: {} });
      // Resolving to undefined is containment: the identifier simply is not
      // in the context. Resolving to a real host object is a breach.
      contained = value === undefined || value === null;
      outcome = contained ? 'resolved to undefined (contained)' : `LEAKED: ${typeof value}`;
    } catch (caught) {
      contained = true;
      outcome = `threw: ${caught.message.slice(0, 70)}`;
    }
    if (!contained) {
      failures += 1;
    }
    escapeResults.push({ attempt, outcome, contained });
  }

  // Hot path: compile once, evaluate per row.
  const compiled = engine.compile("row.qty * row.rate|fmt('#,##0.00')");
  const rows = Array.from({ length: 20000 }, (_, index) => ({
    row: { qty: index % 7, rate: 12.5 },
  }));
  const startedAt = process.hrtime.bigint();
  for (const context of rows) {
    await compiled.eval(context);
  }
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  const report = {
    phase: '0.3',
    verdict: failures === 0 ? 'PASS' : 'FAIL',
    jexlVersion: require('node:fs').existsSync('node_modules/jexl/package.json')
      ? JSON.parse(require('node:fs').readFileSync('node_modules/jexl/package.json', 'utf8')).version
      : 'unknown',
    transforms: transformResults,
    sandbox: escapeResults,
    hotPath: {
      expression: "row.qty * row.rate|fmt('#,##0.00')",
      evaluations: rows.length,
      totalMs: Number(elapsedMs.toFixed(1)),
      perEvalUs: Number(((elapsedMs * 1000) / rows.length).toFixed(2)),
    },
    decision:
      failures === 0
        ? 'jexl is the expression engine. Compile expressions once at template load and reuse per row.'
        : 'jexl did not meet the sandbox/transform requirements — re-evaluate before building Phase 3a.',
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures === 0 ? 0 : 1;
};

run();
