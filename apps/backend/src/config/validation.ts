// eslint-disable-next-line @typescript-eslint/no-var-requires
const Joi = require('joi');

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  LEADHUNTER_DATA_DIR: Joi.string().optional(),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  GOOGLE_PLACES_API_KEY: Joi.string().optional(),
  OPENAI_API_KEY: Joi.string().optional(),
});
