import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { AuthService } from './services/AuthService';

const startServer = async () => {
  await connectDB();

  // Ensure default administrator account is provisioned
  await AuthService.ensureDefaultAdmin();

  const app = createApp();


  app.listen(ENV.PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Cash Book Server is running on port ${ENV.PORT}`);
    console.log(`📡 Environment: ${ENV.NODE_ENV}`);
    console.log(`🔗 API Base: http://localhost:${ENV.PORT}/api`);
    console.log(`===============================================`);
  });
};

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
