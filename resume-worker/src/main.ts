import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3005;

  await app.listen(port);
  console.log(`🚀 Resume Worker is running on: http://localhost:${port}`);
  console.log(`📊 MongoDB: ${configService.get<string>('MONGODB_URI')}`);
}

bootstrap();
