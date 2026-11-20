import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string().min(1),
  REDIS_URI: z.string().min(1),
  RABBITMQ_URI: z.string().min(1),
  CREDENTIALS_ENCRYPTION_KEY: z.string().length(64)
});

export const env = envSchema.parse(process.env);
