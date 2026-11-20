import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URI, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true
});

export const redisSub = redis.duplicate();

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));
