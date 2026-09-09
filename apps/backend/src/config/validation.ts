// eslint-disable-next-line @typescript-eslint/no-var-requires
const Joi = require('joi');

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  API_HOST: Joi.string().default('0.0.0.0'),
  LOCAL_PERSONAL_MODE: Joi.boolean().default(false),
  LOCAL_USER_EMAIL: Joi.string().email().default('pesquisa.local@leadhunter.app'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  GOOGLE_PLACES_API_KEY: Joi.string().allow('').optional(),
  OPENAI_API_KEY: Joi.string().allow('').optional(),
});
