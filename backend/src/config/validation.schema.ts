import * as Joi from 'joi';

export const validate = (config: Record<string, any>) => {
  const { error, value } = validationSchema.validate(config, {
    allowUnknown: true,
  });
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  // If REDIS_PASSWORD is provided but REDIS_URL doesn't include credentials,
  // inject the password into the URL so libraries that read REDIS_URL directly
  // will authenticate correctly (avoids NOAUTH errors).
  try {
    const redisUrl: string | undefined = value.REDIS_URL;
    const redisPassword: string | undefined = value.REDIS_PASSWORD;
    if (redisUrl && redisPassword) {
      // Only modify if URL does not already contain credentials (@)
      if (!/@/.test(redisUrl)) {
        const match = redisUrl.match(/^(redis(?:s)?:\/\/)(.*)$/i);
        if (match) {
          const scheme = match[1]; // e.g. 'redis://'
          const rest = match[2]; // e.g. 'redis:6379'
          // Build redis URL with empty username and password: 'redis://:password@host:port'
          value.REDIS_URL = `${scheme}${':' + redisPassword + '@' + rest}`;
          // Also update process.env so libraries that read process.env.REDIS_URL
          // (instead of using ConfigService) receive the URL with credentials.
          try {
            process.env.REDIS_URL = value.REDIS_URL;
          } catch (e) {
            // ignore if process.env is not writable in some environments
          }
        }
      }
    }
  } catch (e) {
    // Non-fatal: if parsing fails, return original value and let services handle auth via REDIS_PASSWORD
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
  REDIS_PASSWORD: Joi.string().optional(),
  
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
