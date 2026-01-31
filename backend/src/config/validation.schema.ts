import * as Joi from 'joi';

export const validate = (config: Record<string, any>) => {
  const { error, value } = validationSchema.validate(config, {
    allowUnknown: true,
  });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  return value;
};

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('24h'),
  
  CORS_ORIGIN: Joi.string().default('*'),
  
  // WhatsApp
  WHATSAPP_PROVIDER: Joi.string()
    .valid('web-qr', 'cloud-api')
    .default('web-qr'),
  WHATSAPP_CLOUD_API_TOKEN: Joi.string().optional(),
  WHATSAPP_PHONE_ID: Joi.string().optional(),
  
  // Gemini
  GEMINI_API_KEY: Joi.string().optional(),
  
  // Storage
  STORAGE_PROVIDER: Joi.string()
    .valid('local', 's3', 'minio')
    .default('local'),
  STORAGE_PATH: Joi.string().default('./storage'),
  S3_BUCKET: Joi.string().optional(),
  S3_REGION: Joi.string().optional(),
  S3_ACCESS_KEY: Joi.string().optional(),
  S3_SECRET_KEY: Joi.string().optional(),
  
  // Admin seed
  ADMIN_WORKSPACE_SLUG: Joi.string().default('default'),
  ADMIN_KEY_PREVIEW: Joi.string().optional(),
  
  DEBUG: Joi.boolean().default(false),
});
