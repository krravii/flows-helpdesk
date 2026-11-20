import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().default(4000),
    APP_URL: z.string().url().default('http://localhost:5173'),
    MONGO_URI: z.string().min(1),
    REDIS_URI: z.string().min(1),
    RABBITMQ_URI: z.string().min(1),
    S3_ENDPOINT: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('flows-helpdesk-attachments'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    COOKIE_SECURE: z.coerce.boolean().default(false),
    CREDENTIALS_ENCRYPTION_KEY: z.string().length(64)
});

export const env = envSchema.parse(process.env);
