import amqplib from 'amqplib';
import { EXCHANGES, QUEUES } from '@flows-helpdesk/shared';
import { env } from '../config/env.js';

let connection = null;
let channel = null;

export async function connectRabbitMQ() {
    if (channel) return channel;

    connection = await amqplib.connect(env.RABBITMQ_URI);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGES.EVENTS, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.DLX, 'direct', { durable: true });

    await channel.assertQueue(QUEUES.DEAD_LETTER, { durable: true });
    await channel.bindQueue(QUEUES.DEAD_LETTER, EXCHANGES.DLX, 'dead');

    const queueArgs = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': EXCHANGES.DLX,
            'x-dead-letter-routing-key': 'dead'
        }
    };

    await channel.assertQueue(QUEUES.EMAIL_INBOUND_RAW, queueArgs);
    await channel.assertQueue(QUEUES.EMAIL_OUTBOUND_SEND, queueArgs);
    await channel.assertQueue(QUEUES.SLA_EVALUATE, queueArgs);
    await channel.assertQueue(QUEUES.AUDIT_LOG_WRITE, { durable: true });

    console.log('[RabbitMQ] Exchanges & durable queues initialized');
    return channel;
}

export function getRabbitChannel() {
    if (!channel) throw new Error('RabbitMQ channel not initialized');
    return channel;
}
