import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
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
  JWT_EXPIRES_IN: Joi.number().integer().min(1).default(3600),
  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
});
