import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.enableCors();

    // Global validation pipe (template default)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Global exception filter and logging interceptor (template default)
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Swagger/OpenAPI documentation
    const config = new DocumentBuilder()
      .setTitle('Worker Template API')
      .setDescription('Template worker for creating new workers')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'jwt',
      )
      .addTag('Health', 'Health checks')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      customSiteTitle: 'Worker Template API Documentation',
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    Logger.log(`Application running on port ${port}`, 'Bootstrap');
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
