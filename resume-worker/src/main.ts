import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
  const port = configService.get<number>('PORT') || 3006;

  // Swagger/OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Resume Worker API')
    .setDescription(
      'AI-powered resume generation, evaluation, and tailoring platform',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addTag('Resumes', 'Resume CRUD operations')
    .addTag('Experience Bank', 'Manage bullet point library with vector search')
    .addTag('Job Postings', 'Extract and manage job postings')
    .addTag('Evaluation', 'Evaluate resumes and bullets')
    .addTag('Tailoring', 'Full resume tailoring workflow')
    .addTag('Editing', 'LaTeX editing operations')
    .addTag('Cover Letter', 'Generate tailored cover letters')
    .addTag('Health', 'Health checks and metrics')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: 'Resume Worker API Documentation',
  });

  await app.listen(port);
  console.log(`🚀 Resume Worker is running on: http://localhost:${port}`);
  console.log(`📊 MongoDB: ${configService.get<string>('MONGODB_URI')}`);
  console.log(`📚 Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
