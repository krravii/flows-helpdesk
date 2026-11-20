import express from 'express';
import http from 'node:http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env.js';
import { connectMongo } from './infra/mongo.js';
import { redis } from './infra/redis.js';
import { connectRabbitMQ } from './infra/rabbitmq.js';
import { ensureBucketExists } from './infra/s3.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { organisationsRouter } from './modules/organisations/organisations.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';

async function bootstrap() {
  await connectMongo();
  await redis.ping();
  await connectRabbitMQ();
  await ensureBucketExists();

  const app = express();
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: {
      origin: env.APP_URL,
      credentials: true
    }
  });
  app.set('io', io);

  app.use(helmet());
  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    const redisStatus = await redis.ping();
    res.json({
      status: 'ok',
      service: 'flows-helpdesk-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: 'connected',
        redis: redisStatus === 'PONG' ? 'connected' : 'degraded',
        rabbitmq: 'connected',
        s3: 'connected'
      }
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/organisations', organisationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/admin', adminRouter);

  // Global error handler
  app.use((err, _req, res, _next) => {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: err.errors });
    }
    console.error('[API Error]', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });

  io.on('connection', (socket) => {
    socket.on('ticket:join', (ticketNumber) => socket.join(`ticket:${ticketNumber}`));
    socket.on('ticket:leave', (ticketNumber) => socket.leave(`ticket:${ticketNumber}`));
  });

  server.listen(env.API_PORT, () => {
    console.log(`[Flows Helpdesk API] Running on http://localhost:${env.API_PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
