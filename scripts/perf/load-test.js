#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { setTimeout: sleep } = require('node:timers/promises');

// Default target follows the API's own .env (PORT / HTTPS_ENABLED) so the perf
// presets hit the running server without needing --base-url on every run.
function resolveDefaultBaseUrl() {
  if (process.env.PERF_BASE_URL) {
    return process.env.PERF_BASE_URL;
  }
  const env = { ...readEnvFile(path.resolve(__dirname, '..', '..', '.env')), ...process.env };
  const port = env.PORT || '3000';
  const protocol = String(env.HTTPS_ENABLED).toLowerCase() === 'true' ? 'https' : 'http';
  return `${protocol}://localhost:${port}`;
}

function readEnvFile(filePath) {
  try {
    return require('dotenv').parse(fs.readFileSync(filePath));
  } catch {
    return {};
  }
}

const DEFAULT_BASE_URL = resolveDefaultBaseUrl();
const DEFAULT_MAX_FAILURE_RATE = 5;
const MAX_LATENCY_SAMPLES = 200000;

const API_MIX_ROUTES = [
  { name: 'health', method: 'GET', path: '/api/v1/health', weight: 4 },
  { name: 'users.list', method: 'GET', path: '/api/v1/users', weight: 3 },
  { name: 'itemGroups.list', method: 'GET', path: '/api/v1/item-groups/list', weight: 2 },
  { name: 'itemBrands.list', method: 'GET', path: '/api/v1/item-brands/list', weight: 2 },
  { name: 'itemSections.list', method: 'GET', path: '/api/v1/item-sections/list', weight: 2 },
  { name: 'units.list', method: 'GET', path: '/api/v1/units/list', weight: 2 },
  { name: 'gridDetails.list', method: 'GET', path: '/api/v1/grid-details/list', weight: 1 },
  { name: 'gridColumns.list', method: 'GET', path: '/api/v1/grid-columns/list', weight: 1 },
];

const SCENARIOS = {
  smoke: {
    name: 'smoke',
    durationMs: 15000,
    concurrency: 5,
    timeoutMs: 5000,
    thinkTimeMs: 0,
    maxFailureRate: 10,
    routes: [{ name: 'health', method: 'GET', path: '/api/v1/health', weight: 1 }],
  },
  baseline: {
    name: 'baseline',
    durationMs: 60000,
    concurrency: 20,
    timeoutMs: 5000,
    thinkTimeMs: 0,
    maxFailureRate: DEFAULT_MAX_FAILURE_RATE,
    routes: API_MIX_ROUTES,
  },
  stress: {
    name: 'stress',
    durationMs: 180000,
    concurrency: 80,
    timeoutMs: 5000,
    thinkTimeMs: 0,
    maxFailureRate: DEFAULT_MAX_FAILURE_RATE,
    routes: API_MIX_ROUTES,
  },
};

function printHelp() {
  console.log(`
Usage:
  node scripts/perf/load-test.js [options]

Options:
  --scenario <smoke|baseline|stress>  Scenario preset (default: baseline)
  --base-url <url>                    Base URL (default: ${DEFAULT_BASE_URL})
  --duration <value>                  Override duration (e.g. 30s, 2m, 10000ms)
  --concurrency <number>              Override concurrency
  --timeout-ms <number>               Per-request timeout in milliseconds
  --think-time-ms <number>            Pause between requests in each worker
  --routes-file <path>                JSON file with custom routes/config
  --accept-status <csv>               Extra statuses treated as success (example: 429,503)
  --header "Key: Value"               Header applied to every request (repeatable)
  --max-failure-rate <percent>        Fail run above this threshold (default: ${DEFAULT_MAX_FAILURE_RATE})
  --output <path>                     Write JSON report to file
  --insecure-tls                      Disable TLS certificate validation
  --help                              Show this message

Routes file format:
{
  "duration": "60s",
  "concurrency": 25,
  "timeoutMs": 5000,
  "thinkTimeMs": 0,
  "maxFailureRate": 5,
  "routes": [
    {
      "name": "health",
      "method": "GET",
      "path": "/api/v1/health",
      "weight": 3,
      "expectedStatuses": [200]
    }
  ]
}
`);
}

function parseDuration(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Duration must be a non-empty string');
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(ms|s|m)?$/);
  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] || 's';

  if (amount <= 0) {
    throw new Error(`Duration must be greater than 0: ${value}`);
  }

  if (unit === 'ms') {
    return amount;
  }
  if (unit === 's') {
    return amount * 1000;
  }
  if (unit === 'm') {
    return amount * 60 * 1000;
  }

  throw new Error(`Unsupported duration unit: ${unit}`);
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function parseNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return parsed;
}

function parseStatusCsv(value) {
  const statuses = new Set();
  for (const item of value.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const code = parsePositiveInt(trimmed, 'status');
    statuses.add(code);
  }

  return statuses;
}

function parseHeader(value) {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error(`Invalid header value: ${value}`);
  }

  const key = value.slice(0, separatorIndex).trim();
  const headerValue = value.slice(separatorIndex + 1).trim();

  if (!key || !headerValue) {
    throw new Error(`Invalid header value: ${value}`);
  }

  return { key, value: headerValue };
}

function parseArguments(argv) {
  const parsed = {
    scenario: 'baseline',
    baseUrl: DEFAULT_BASE_URL,
    durationMs: undefined,
    concurrency: undefined,
    timeoutMs: undefined,
    thinkTimeMs: undefined,
    routesFile: undefined,
    outputPath: undefined,
    help: false,
    insecureTls: false,
    maxFailureRate: undefined,
    headers: {},
    acceptedStatuses: new Set(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const [flag, inlineValue] = current.split('=', 2);

    const readValue = () => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }

      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${flag}`);
      }

      index += 1;
      return next;
    };

    if (flag === '--help' || flag === '-h') {
      parsed.help = true;
      continue;
    }
    if (flag === '--insecure-tls') {
      parsed.insecureTls = true;
      continue;
    }
    if (flag === '--scenario') {
      parsed.scenario = readValue();
      continue;
    }
    if (flag === '--base-url') {
      parsed.baseUrl = readValue();
      continue;
    }
    if (flag === '--duration') {
      parsed.durationMs = parseDuration(readValue());
      continue;
    }
    if (flag === '--concurrency') {
      parsed.concurrency = parsePositiveInt(readValue(), 'concurrency');
      continue;
    }
    if (flag === '--timeout-ms') {
      parsed.timeoutMs = parsePositiveInt(readValue(), 'timeout-ms');
      continue;
    }
    if (flag === '--think-time-ms') {
      const rawValue = readValue();
      const thinkTimeMs = parseNumber(rawValue, 'think-time-ms');
      if (thinkTimeMs < 0) {
        throw new Error('think-time-ms must be >= 0');
      }
      parsed.thinkTimeMs = thinkTimeMs;
      continue;
    }
    if (flag === '--routes-file') {
      parsed.routesFile = readValue();
      continue;
    }
    if (flag === '--output') {
      parsed.outputPath = readValue();
      continue;
    }
    if (flag === '--accept-status') {
      const statuses = parseStatusCsv(readValue());
      for (const status of statuses) {
        parsed.acceptedStatuses.add(status);
      }
      continue;
    }
    if (flag === '--max-failure-rate') {
      const maxFailureRate = parseNumber(readValue(), 'max-failure-rate');
      if (maxFailureRate < 0 || maxFailureRate > 100) {
        throw new Error('max-failure-rate must be between 0 and 100');
      }
      parsed.maxFailureRate = maxFailureRate;
      continue;
    }
    if (flag === '--header') {
      const header = parseHeader(readValue());
      parsed.headers[header.key] = header.value;
      continue;
    }

    throw new Error(`Unknown option: ${current}`);
  }

  return parsed;
}

function parseRoutesFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(rawContent);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('routes file must be a JSON object');
  }
  if (!Array.isArray(parsed.routes) || parsed.routes.length === 0) {
    throw new Error('routes file must include a non-empty routes array');
  }

  return parsed;
}

function normalizePath(routePath) {
  if (routePath.startsWith('http://') || routePath.startsWith('https://')) {
    return routePath;
  }

  if (routePath.startsWith('/')) {
    return routePath;
  }

  return `/${routePath}`;
}

function normalizeRoute(route, index) {
  if (!route || typeof route !== 'object') {
    throw new Error(`Route at index ${index} must be an object`);
  }

  if (typeof route.path !== 'string' || route.path.trim().length === 0) {
    throw new Error(`Route at index ${index} must include a non-empty path`);
  }

  const method = typeof route.method === 'string' ? route.method.trim().toUpperCase() : 'GET';
  const weight = route.weight === undefined ? 1 : Number(route.weight);
  const name =
    typeof route.name === 'string' && route.name.trim().length > 0
      ? route.name.trim()
      : `${method} ${route.path.trim()}`;

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`Route "${name}" has invalid weight`);
  }

  const normalizedRoute = {
    name,
    method,
    path: normalizePath(route.path.trim()),
    weight,
    headers: {},
    body: route.body,
    expectedStatuses: undefined,
  };

  if (route.headers !== undefined) {
    if (!route.headers || typeof route.headers !== 'object' || Array.isArray(route.headers)) {
      throw new Error(`Route "${name}" has invalid headers`);
    }

    for (const [key, value] of Object.entries(route.headers)) {
      normalizedRoute.headers[String(key)] = String(value);
    }
  }

  if (route.expectedStatuses !== undefined) {
    if (!Array.isArray(route.expectedStatuses) || route.expectedStatuses.length === 0) {
      throw new Error(`Route "${name}" expectedStatuses must be a non-empty array`);
    }

    normalizedRoute.expectedStatuses = new Set();
    for (const status of route.expectedStatuses) {
      normalizedRoute.expectedStatuses.add(parsePositiveInt(status, `expected status for ${name}`));
    }
  }

  return normalizedRoute;
}

function resolveScenarioConfig(cliOptions) {
  const baseScenario = SCENARIOS[cliOptions.scenario];
  if (!baseScenario) {
    throw new Error(`Unknown scenario "${cliOptions.scenario}"`);
  }

  let fileConfig = {};
  if (cliOptions.routesFile) {
    fileConfig = parseRoutesFile(cliOptions.routesFile);
  }

  const merged = {
    name: baseScenario.name,
    durationMs: baseScenario.durationMs,
    concurrency: baseScenario.concurrency,
    timeoutMs: baseScenario.timeoutMs,
    thinkTimeMs: baseScenario.thinkTimeMs,
    maxFailureRate: baseScenario.maxFailureRate,
    routes: baseScenario.routes,
  };

  if (fileConfig.duration !== undefined) {
    merged.durationMs = parseDuration(String(fileConfig.duration));
  }
  if (fileConfig.durationMs !== undefined) {
    merged.durationMs = parsePositiveInt(fileConfig.durationMs, 'durationMs');
  }
  if (fileConfig.concurrency !== undefined) {
    merged.concurrency = parsePositiveInt(fileConfig.concurrency, 'concurrency');
  }
  if (fileConfig.timeoutMs !== undefined) {
    merged.timeoutMs = parsePositiveInt(fileConfig.timeoutMs, 'timeoutMs');
  }
  if (fileConfig.thinkTimeMs !== undefined) {
    const thinkTimeMs = parseNumber(fileConfig.thinkTimeMs, 'thinkTimeMs');
    if (thinkTimeMs < 0) {
      throw new Error('thinkTimeMs in routes file must be >= 0');
    }
    merged.thinkTimeMs = thinkTimeMs;
  }
  if (fileConfig.maxFailureRate !== undefined) {
    const maxFailureRate = parseNumber(fileConfig.maxFailureRate, 'maxFailureRate');
    if (maxFailureRate < 0 || maxFailureRate > 100) {
      throw new Error('maxFailureRate in routes file must be between 0 and 100');
    }
    merged.maxFailureRate = maxFailureRate;
  }
  if (fileConfig.name !== undefined) {
    merged.name = String(fileConfig.name).trim() || merged.name;
  }
  if (fileConfig.routes !== undefined) {
    merged.routes = fileConfig.routes;
  }

  if (cliOptions.durationMs !== undefined) {
    merged.durationMs = cliOptions.durationMs;
  }
  if (cliOptions.concurrency !== undefined) {
    merged.concurrency = cliOptions.concurrency;
  }
  if (cliOptions.timeoutMs !== undefined) {
    merged.timeoutMs = cliOptions.timeoutMs;
  }
  if (cliOptions.thinkTimeMs !== undefined) {
    merged.thinkTimeMs = cliOptions.thinkTimeMs;
  }
  if (cliOptions.maxFailureRate !== undefined) {
    merged.maxFailureRate = cliOptions.maxFailureRate;
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(cliOptions.baseUrl);
  } catch {
    throw new Error(`Invalid base URL: ${cliOptions.baseUrl}`);
  }

  merged.baseUrl = parsedBaseUrl.toString();
  merged.routes = merged.routes.map((route, index) => normalizeRoute(route, index));
  merged.headers = { ...cliOptions.headers };
  merged.acceptedStatuses = cliOptions.acceptedStatuses;

  return merged;
}

function buildWeightedRoutes(routes) {
  let totalWeight = 0;
  const weightedRoutes = routes.map((route) => {
    totalWeight += route.weight;
    return {
      route,
      threshold: totalWeight,
    };
  });

  return { weightedRoutes, totalWeight };
}

function pickRoute(weightedRouteState) {
  const randomWeight = Math.random() * weightedRouteState.totalWeight;
  for (const item of weightedRouteState.weightedRoutes) {
    if (randomWeight < item.threshold) {
      return item.route;
    }
  }

  return weightedRouteState.weightedRoutes[weightedRouteState.weightedRoutes.length - 1].route;
}

class MetricsTracker {
  constructor() {
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failedRequests = 0;
    this.totalBytes = 0;
    this.statusCounts = new Map();
    this.errorCounts = new Map();
    this.routeCounts = new Map();
    this.latencyMinMs = Number.POSITIVE_INFINITY;
    this.latencyMaxMs = 0;
    this.latencyTotalMs = 0;
    this.latencyMeasurements = 0;
    this.latencySamples = [];
  }

  record(routeName, latencyMs, status, isSuccess, bytes, errorCode) {
    this.totalRequests += 1;
    this.latencyMeasurements += 1;
    this.latencyTotalMs += latencyMs;
    this.latencyMinMs = Math.min(this.latencyMinMs, latencyMs);
    this.latencyMaxMs = Math.max(this.latencyMaxMs, latencyMs);
    this.totalBytes += bytes;

    if (isSuccess) {
      this.successRequests += 1;
    } else {
      this.failedRequests += 1;
    }

    const routeCount = this.routeCounts.get(routeName) || 0;
    this.routeCounts.set(routeName, routeCount + 1);

    const statusKey = String(status);
    const statusCount = this.statusCounts.get(statusKey) || 0;
    this.statusCounts.set(statusKey, statusCount + 1);

    if (errorCode) {
      const errorCount = this.errorCounts.get(errorCode) || 0;
      this.errorCounts.set(errorCode, errorCount + 1);
    }

    if (this.latencySamples.length < MAX_LATENCY_SAMPLES) {
      this.latencySamples.push(latencyMs);
      return;
    }

    // Reservoir sampling to avoid unbounded memory on long tests.
    const sampleIndex = Math.floor(Math.random() * this.latencyMeasurements);
    if (sampleIndex < MAX_LATENCY_SAMPLES) {
      this.latencySamples[sampleIndex] = latencyMs;
    }
  }
}

function latencyPercentile(sortedSamples, percentile) {
  if (sortedSamples.length === 0) {
    return 0;
  }

  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  const index = Math.min(sortedSamples.length - 1, Math.max(0, rank - 1));
  return sortedSamples[index];
}

async function performRequest(route, config) {
  const url = new URL(route.path, config.baseUrl).toString();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);

  const headers = {
    Accept: 'application/json',
    ...config.headers,
    ...route.headers,
  };

  const requestInit = {
    method: route.method,
    headers,
    signal: controller.signal,
  };

  if (route.body !== undefined) {
    if (typeof route.body === 'string') {
      requestInit.body = route.body;
    } else {
      requestInit.body = JSON.stringify(route.body);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  try {
    const response = await fetch(url, requestInit);
    const payload = await response.text();

    return {
      status: response.status,
      bytes: Buffer.byteLength(payload),
      errorCode: null,
    };
  } catch (error) {
    if (error && typeof error === 'object' && error.name === 'AbortError') {
      return {
        status: 0,
        bytes: 0,
        errorCode: 'timeout',
      };
    }

    const errorCode =
      error && typeof error === 'object' && 'code' in error && error.code
        ? String(error.code)
        : error && typeof error === 'object' && 'name' in error && error.name
          ? String(error.name)
          : 'request_error';

    return {
      status: 0,
      bytes: 0,
      errorCode,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function isSuccessStatus(status, route, acceptedStatuses) {
  if (acceptedStatuses.has(status)) {
    return true;
  }

  if (route.expectedStatuses) {
    return route.expectedStatuses.has(status);
  }

  return status >= 200 && status < 300;
}

async function runScenario(config) {
  const metrics = new MetricsTracker();
  const weightedRouteState = buildWeightedRoutes(config.routes);
  const startTimeMs = Date.now();
  const startPerfMs = performance.now();
  const stopAtMs = startPerfMs + config.durationMs;

  const workers = Array.from({ length: config.concurrency }, async () => {
    while (performance.now() < stopAtMs) {
      const route = pickRoute(weightedRouteState);
      const startedAt = performance.now();
      const response = await performRequest(route, config);
      const latencyMs = performance.now() - startedAt;
      const success = isSuccessStatus(response.status, route, config.acceptedStatuses);

      metrics.record(route.name, latencyMs, response.status, success, response.bytes, response.errorCode);

      if (config.thinkTimeMs > 0) {
        await sleep(config.thinkTimeMs);
      }
    }
  });

  await Promise.all(workers);

  const endPerfMs = performance.now();
  const endTimeMs = Date.now();
  const elapsedSeconds = (endPerfMs - startPerfMs) / 1000;
  const sortedSamples = [...metrics.latencySamples].sort((a, b) => a - b);

  const statusCounts = Object.fromEntries(
    [...metrics.statusCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0])),
  );
  const errorCounts = Object.fromEntries(
    [...metrics.errorCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  const routeCounts = Object.fromEntries(
    [...metrics.routeCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );

  const avgLatencyMs = metrics.totalRequests > 0 ? metrics.latencyTotalMs / metrics.totalRequests : 0;
  const throughput = elapsedSeconds > 0 ? metrics.totalRequests / elapsedSeconds : 0;
  const successRate = metrics.totalRequests > 0 ? (metrics.successRequests / metrics.totalRequests) * 100 : 0;
  const failureRate = metrics.totalRequests > 0 ? (metrics.failedRequests / metrics.totalRequests) * 100 : 0;
  const bytesPerSecond = elapsedSeconds > 0 ? metrics.totalBytes / elapsedSeconds : 0;

  const summary = {
    scenario: config.name,
    baseUrl: config.baseUrl,
    startedAt: new Date(startTimeMs).toISOString(),
    finishedAt: new Date(endTimeMs).toISOString(),
    durationSeconds: elapsedSeconds,
    concurrency: config.concurrency,
    timeoutMs: config.timeoutMs,
    thinkTimeMs: config.thinkTimeMs,
    maxFailureRate: config.maxFailureRate,
    requests: {
      total: metrics.totalRequests,
      success: metrics.successRequests,
      failed: metrics.failedRequests,
      successRate,
      failureRate,
      throughputPerSecond: throughput,
    },
    traffic: {
      totalBytes: metrics.totalBytes,
      bytesPerSecond,
    },
    latencyMs: {
      min: metrics.totalRequests > 0 ? metrics.latencyMinMs : 0,
      avg: avgLatencyMs,
      max: metrics.latencyMaxMs,
      p50: latencyPercentile(sortedSamples, 50),
      p90: latencyPercentile(sortedSamples, 90),
      p95: latencyPercentile(sortedSamples, 95),
      p99: latencyPercentile(sortedSamples, 99),
    },
    statusCounts,
    errorCounts,
    routeCounts,
    acceptedStatuses: [...config.acceptedStatuses.values()].sort((a, b) => a - b),
  };

  return summary;
}

function formatNumber(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function printSummary(summary) {
  console.log('\nPerformance Test Summary');
  console.log('========================');
  console.log(`Scenario: ${summary.scenario}`);
  console.log(`Base URL: ${summary.baseUrl}`);
  console.log(`Started: ${summary.startedAt}`);
  console.log(`Finished: ${summary.finishedAt}`);
  console.log(`Duration: ${formatNumber(summary.durationSeconds)}s`);
  console.log(`Concurrency: ${summary.concurrency}`);
  console.log(`Timeout: ${summary.timeoutMs}ms`);
  console.log(`Think time: ${summary.thinkTimeMs}ms`);
  console.log(`Throughput: ${formatNumber(summary.requests.throughputPerSecond)} req/s`);
  console.log(`Total requests: ${summary.requests.total}`);
  console.log(
    `Success: ${summary.requests.success} (${formatNumber(summary.requests.successRate)}%) | ` +
      `Failed: ${summary.requests.failed} (${formatNumber(summary.requests.failureRate)}%)`,
  );
  console.log(
    `Latency (ms): min=${formatNumber(summary.latencyMs.min)} avg=${formatNumber(summary.latencyMs.avg)} ` +
      `p95=${formatNumber(summary.latencyMs.p95)} p99=${formatNumber(summary.latencyMs.p99)} ` +
      `max=${formatNumber(summary.latencyMs.max)}`,
  );
  console.log(`Traffic: ${summary.traffic.totalBytes} bytes (${formatNumber(summary.traffic.bytesPerSecond)} B/s)`);

  console.log('\nStatus Codes');
  if (Object.keys(summary.statusCounts).length === 0) {
    console.log('- none');
  } else {
    for (const [status, count] of Object.entries(summary.statusCounts)) {
      console.log(`- ${status}: ${count}`);
    }
  }

  if (Object.keys(summary.errorCounts).length > 0) {
    console.log('\nErrors');
    for (const [errorCode, count] of Object.entries(summary.errorCounts)) {
      console.log(`- ${errorCode}: ${count}`);
    }
  }

  console.log('\nRoute Distribution');
  for (const [routeName, count] of Object.entries(summary.routeCounts)) {
    console.log(`- ${routeName}: ${count}`);
  }

  const throttleCount = summary.statusCounts['429'] || 0;
  if (throttleCount > 0) {
    console.log(
      '\nNote: HTTP 429 responses detected. Increase THROTTLE_LIMIT for load tests or add 429 as accepted status.',
    );
  }
}

function writeReport(outputPath, summary) {
  const resolved = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\nSaved report: ${resolved}`);
}

async function main() {
  let cliOptions;
  try {
    cliOptions = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (cliOptions.help) {
    printHelp();
    return;
  }

  if (cliOptions.insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn(
      'Warning: TLS certificate validation disabled for this run (--insecure-tls). Use only in local environments.',
    );
  }

  let scenarioConfig;
  try {
    scenarioConfig = resolveScenarioConfig(cliOptions);
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Running "${scenarioConfig.name}" against ${scenarioConfig.baseUrl} ` +
      `for ${scenarioConfig.durationMs}ms with concurrency ${scenarioConfig.concurrency}...`,
  );

  let summary;
  try {
    summary = await runScenario(scenarioConfig);
  } catch (error) {
    console.error(`Runtime error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  printSummary(summary);

  if (cliOptions.outputPath) {
    writeReport(cliOptions.outputPath, summary);
  }

  if (summary.requests.total === 0) {
    console.error('\nNo requests were sent. Verify connectivity and scenario configuration.');
    process.exitCode = 1;
    return;
  }

  if (summary.requests.failureRate > summary.maxFailureRate) {
    console.error(
      `\nFailure rate ${formatNumber(summary.requests.failureRate)}% exceeds threshold ` +
        `${formatNumber(summary.maxFailureRate)}%.`,
    );
    process.exitCode = 1;
  }
}

void main();
