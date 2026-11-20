import mongoose from 'mongoose';
import { env } from '../config/env.js';

export async function connectMongo() {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGO_URI, {
        maxPoolSize: 25,
        serverSelectionTimeoutMS: 5000
    });
    console.log('[MongoDB] Connected to Replica Set rs0');
}