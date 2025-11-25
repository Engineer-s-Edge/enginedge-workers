import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { HttpExceptionFilter } from './infrastructure/filters/http-exception.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
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
    const nextChecksum = createHash('sha256').update(nextContent).digest('hex');

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
    app.useWebSocketAdapter(new WsAdapter(app));
    app.enableCors();

    // Global exception filter
    app.useGlobalFilters(new HttpExceptionFilter());

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Global logging interceptor (inject ILogger instance)
    const appLogger = app.get<any>('ILogger');
    app.useGlobalInterceptors(new LoggingInterceptor(appLogger));

    // Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
      .setTitle('Interview Worker API')
      .setDescription(
        'AI-powered interview sessions, question management, and candidate profiling',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'jwt',
      )
      .addTag('Interviews', 'Interview session management')
      .addTag('Sessions', 'Interview session operations')
      .addTag('Questions', 'Question management')
      .addTag('Profiles', 'Candidate profile management')
      .addTag('Reports', 'Interview reports and analytics')
      .addTag('Code Execution', 'Code execution for technical interviews')
      .addTag('Webhooks', 'Webhook endpoints')
      .addTag('Health', 'Health checks')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      customSiteTitle: 'Interview Worker API Documentation',
    });
    await syncOpenApiDocument(document);

    const port = process.env.PORT || 3004;
    const server = await app.listen(port);
    Logger.log(`Application running on port ${port}`, 'Bootstrap');
    Logger.log(
      `WebSocket available at ws://localhost:${port}/interview`,
      'Bootstrap',
    );
    Logger.log(
      `Swagger documentation available at http://localhost:${port}/api/docs`,
      'Bootstrap',
    );

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
