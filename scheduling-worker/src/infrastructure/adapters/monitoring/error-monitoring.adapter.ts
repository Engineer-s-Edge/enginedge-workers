import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Error Monitoring Adapter
 *
 * Integrates with error tracking services (Sentry, Rollbar, etc.)
 * for production error monitoring and alerting.
 *
 * Infrastructure Adapter - Error monitoring integration
 */
@Injectable()
export class ErrorMonitoringAdapter {
  private readonly logger = new Logger(ErrorMonitoringAdapter.name);
  private sentryInitialized = false;
  private sentry: any = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeSentry();
  }

  /**
   * Initialize Sentry if configured
   */
  private initializeSentry(): void {
    const sentryDsn = this.configService.get<string>('SENTRY_DSN');
    const sentryEnvironment =
      this.configService.get<string>('SENTRY_ENVIRONMENT') || 'production';

    if (!sentryDsn) {
      this.logger.debug('Sentry DSN not configured, error monitoring disabled');
      return;
    }

    try {
      // Dynamic import to make Sentry optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment,
        tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
        beforeSend(event: any) {
          // Filter out sensitive data if needed
          return event;
        },
      });

      this.sentry = Sentry;
      this.sentryInitialized = true;
      this.logger.log('Sentry error monitoring initialized');
    } catch (error) {
      this.logger.warn(
        `Failed to initialize Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Graceful fallback - continue without Sentry
    }
  }

  /**
   * Capture an exception
   */
  captureException(
    exception: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (!this.sentryInitialized || !this.sentry) {
      this.logger.debug('Sentry not initialized, skipping exception capture');
      return;
    }

    try {
      if (context) {
        this.sentry.withScope((scope: any) => {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
          this.sentry.captureException(exception);
        });
      } else {
        this.sentry.captureException(exception);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to capture exception in Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' | 'fatal' = 'error',
    context?: Record<string, unknown>,
  ): void {
    if (!this.sentryInitialized || !this.sentry) {
      this.logger.debug('Sentry not initialized, skipping message capture');
      return;
    }

    try {
      if (context) {
        this.sentry.withScope((scope: any) => {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
          this.sentry.captureMessage(message, level);
        });
      } else {
        this.sentry.captureMessage(message, level);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to capture message in Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id?: string; email?: string; username?: string }): void {
    if (!this.sentryInitialized || !this.sentry) {
      return;
    }

    try {
      this.sentry.setUser(user);
    } catch (error) {
      this.logger.warn(
        `Failed to set user in Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void {
    if (!this.sentryInitialized || !this.sentry) {
      return;
    }

    try {
      this.sentry.addBreadcrumb({
        message: breadcrumb.message,
        category: breadcrumb.category || 'default',
        level: breadcrumb.level || 'info',
        data: breadcrumb.data,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to add breadcrumb in Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if error monitoring is enabled
   */
  isEnabled(): boolean {
    return this.sentryInitialized;
  }
}
