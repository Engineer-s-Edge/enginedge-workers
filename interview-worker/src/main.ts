import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { HttpExceptionFilter } from './infrastructure/filters/http-exception.filter';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
      .setDescription('AI-powered interview sessions, question management, and candidate profiling')
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

    const port = process.env.PORT || 3004;
    const server = await app.listen(port);
    Logger.log(`Application running on port ${port}`, 'Bootstrap');
    Logger.log(
      `WebSocket available at ws://localhost:${port}/interview`,
      'Bootstrap',
    );
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
