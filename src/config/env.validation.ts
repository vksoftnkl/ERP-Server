import * as Joi from 'joi';
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  HOST: Joi.string().trim().default('0.0.0.0'),
  PORT: Joi.number().port().default(3010),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  CORS_CREDENTIALS: Joi.boolean().optional(),
  REQUEST_BODY_LIMIT: Joi.string().trim().default('10mb'),
  LOG_FILE_PATH: Joi.string().default('logs/app.log'),
  ERROR_LOG_FILE_PATH: Joi.string().default('logs/error.log'),
  HTTPS_ENABLED: Joi.boolean().default(false),
  HTTPS_CERT_PATH: Joi.when('HTTPS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().allow('').default(''),
  }),
  HTTPS_KEY_PATH: Joi.when('HTTPS_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().trim().allow('').default(''),
  }),
  HTTPS_PASSPHRASE: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['postgres', 'postgresql'],
    })
    .optional(),
  DATABASE_READONLY_URL: Joi.string()
    .uri({
      scheme: ['postgres', 'postgresql'],
    })
    .allow('')
    .optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().default('erp_app'),
  DB_PASSWORD: Joi.string().default('erp_password'),
  DB_NAME: Joi.string().default('erp_db'),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNC: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().min(16).default('test-jwt-secret-change-me'),
    otherwise: Joi.string().min(16).required(),
  }),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(7 * 24 * 60 * 60),
  THROTTLE_ENABLED: Joi.boolean().default(true),
  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  REDIS_ENABLED: Joi.boolean().default(false),
  REDIS_URL: Joi.string()
    .uri({
      scheme: ['redis', 'rediss'],
    })
    .allow('')
    .optional(),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_TTL: Joi.number().integer().min(1).default(3600),
  REDIS_USERNAME: Joi.string().allow('').default(''),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_TLS: Joi.boolean().default(false),
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
});
