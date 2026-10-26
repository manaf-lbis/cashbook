import mongoose from 'mongoose';
import { ENV } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      autoIndex: ENV.NODE_ENV !== 'production',
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Graceful disconnection on process exit
    const gracefulExit = async () => {
      try {
        await mongoose.connection.close();
        console.log('[Database] MongoDB connection closed gracefully');
      } catch (err) {
        console.error('[Database] Error closing MongoDB connection:', err);
      }
    };

    process.on('SIGINT', gracefulExit);
    process.on('SIGTERM', gracefulExit);
  } catch (error) {
    console.error(`[Database Error] Could not connect to MongoDB:`, error);
    process.exit(1);
  }
};

