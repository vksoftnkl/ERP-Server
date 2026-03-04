const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : defaultValue;
};

const buildDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const username = encodeURIComponent(process.env.DB_USER ?? 'erp_app');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? 'erp_password');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseNumber(process.env.DB_PORT, 5432);
  const databaseName = process.env.DB_NAME ?? 'erp_db';
  const searchParams = new URLSearchParams({ schema: 'public' });

  if (parseBoolean(process.env.DB_SSL)) {
    searchParams.set('sslmode', 'require');
  }

  return `postgresql://${username}:${password}@${host}:${port}/${databaseName}?${searchParams.toString()}`;
};

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: parseNumber(process.env.PORT, 3010),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '10mb',
    logFilePath: process.env.LOG_FILE_PATH ?? 'logs/app.log',
    errorLogFilePath: process.env.ERROR_LOG_FILE_PATH ?? 'logs/error.log',
    https: {
      enabled: parseBoolean(process.env.HTTPS_ENABLED),
      certPath: process.env.HTTPS_CERT_PATH ?? '',
      keyPath: process.env.HTTPS_KEY_PATH ?? '',
      passphrase: process.env.HTTPS_PASSPHRASE ?? '',
    },
  },
  database: {
    url: buildDatabaseUrl(),
    host: process.env.DB_HOST ?? 'localhost',
    port: parseNumber(process.env.DB_PORT, 5432),
    username: process.env.DB_USER ?? 'erp_app',
    password: process.env.DB_PASSWORD ?? 'erp_password',
    name: process.env.DB_NAME ?? 'erp_db',
    ssl: parseBoolean(process.env.DB_SSL),
    synchronize: parseBoolean(process.env.DB_SYNC),
    logging: parseBoolean(process.env.DB_LOGGING),
  },
  throttler: {
    ttl: parseNumber(process.env.THROTTLE_TTL, 60),
    limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
  },
});
