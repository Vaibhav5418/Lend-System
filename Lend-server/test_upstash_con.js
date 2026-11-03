import './loadEnv.js';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

if (!redisUrl && !process.env.REDIS_HOST) {
  console.error('No REDIS_URL, REDIS_URI, or REDIS_HOST defined in your .env file.');
  process.exit(1);
}

let connectionTarget = redisUrl;
if (connectionTarget && connectionTarget.includes('upstash.io') && connectionTarget.startsWith('redis://')) {
  connectionTarget = connectionTarget.replace(/^redis:\/\//i, 'rediss://');
}

const client = typeof connectionTarget === 'string'
  ? new Redis(connectionTarget, { connectTimeout: 5000, maxRetriesPerRequest: 1 })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });

async function main() {
  console.log('Testing Redis connection from environment variables...');
  try {
    const ping = await client.ping();
    console.log('PING response:', ping);
    await client.set('lendflow:ping', 'OK', 'EX', 10);
    const readBack = await client.get('lendflow:ping');
    console.log('Read back verification:', readBack);
    console.log('Redis connected and verified successfully!');
  } catch (err) {
    console.error('Redis connection error:', err.message || err);
    process.exit(1);
  } finally {
    client.disconnect();
    process.exit(0);
  }
}

main();

