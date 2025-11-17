import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import {
  SwaggerModule,
  DocumentBuilder,
  OpenAPIObject,
} from '@nestjs/swagger';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import { dump } from 'js-yaml';

const { readFile, writeFile, mkdir } = fs;

async function syncOpenApiDocument(document: OpenAPIObject) {
  try {
    const documentationDir = path.resolve(process.cwd(), 'documentation');
    const targetPath = path.join(documentationDir, 'openapi.yaml');
    const nextContent = dump(document, {
      noRefs: true,
      sortKeys: true,
      lineWidth: -1,
    });
    const nextChecksum = createHash('sha256')
      .update(nextContent)
      .digest('hex');

    if (existsSync(targetPath)) {
      const currentContent = await readFile(targetPath, 'utf8');
      const currentChecksum = createHash('sha256')
        .update(currentContent)
        .digest('hex');
      if (currentChecksum === nextChecksum) {
        Logger.log('OpenAPI spec up to date; no changes detected', 'Swagger');
        return;
      }
    }

    await mkdir(documentationDir, { recursive: true });
    await writeFile(targetPath, nextContent, 'utf8');
    Logger.log(`OpenAPI spec updated at ${targetPath}`, 'Swagger');
  } catch (error) {
    Logger.warn(
      `Failed to sync OpenAPI spec: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'Swagger',
    );
  }
}

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.enableCors();

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Global exception filter and logging interceptor
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(app.get(LoggingInterceptor));

    // Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
      .setTitle('Scheduling Worker API')
      .setDescription('Goal management, habit tracking, calendar integration, and ML-powered scheduling')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'jwt',
      )
      .addTag('Goals', 'Goal management')
      .addTag('Habits', 'Habit tracking')
      .addTag('Activities', 'Activity logging')
      .addTag('Calendar', 'Calendar integration')
      .addTag('Schedule', 'Scheduling operations')
      .addTag('ML', 'Machine learning features')
      .addTag('Metrics', 'Metrics and monitoring')
      .addTag('Health', 'Health checks')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      customSiteTitle: 'Scheduling Worker API Documentation',
    });
    await syncOpenApiDocument(document);

    const port = process.env.PORT || 3007;
    await app.listen(port);
    Logger.log(`Scheduling Worker running on port ${port}`, 'Bootstrap');
    Logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`, 'Bootstrap');

    // Handle termination signals
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        Logger.log(
          `${signal} signal received: closing HTTP server`,
          'Bootstrap',
        );
        await app.close();
        Logger.log('HTTP server closed', 'Bootstrap');
        process.exit(0);
      });
    });
  } catch (error) {
    Logger.error(
      `Failed to start the application: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
      'Bootstrap',
    );
    process.exit(1);
  }
}
bootstrap();
