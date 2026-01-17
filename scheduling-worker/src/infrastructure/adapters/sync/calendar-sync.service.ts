import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  ICalendarSyncService,
  SyncState,
} from '../../../application/ports/google-calendar.port';
import { IGoogleCalendarApiService } from '../../../application/ports/google-calendar.port';
import { ICalendarEventRepository } from '../../../application/ports/repositories.port';
import { CalendarEvent } from '../../../domain/entities/calendar-event.entity';
import { CalendarSyncGateway } from '../../gateways/calendar-sync.gateway';
import { MetricsAdapter } from '../monitoring/metrics.adapter';

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
  USER_PROMPT = 'user_prompt',
}

@Injectable()
export class CalendarSyncService implements ICalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly syncStates = new Map<string, SyncState>();
  private readonly strategy: ConflictResolutionStrategy =
    ConflictResolutionStrategy.LAST_WRITE_WINS;

  constructor(
    @Inject('IGoogleCalendarApiService')
    private readonly calendarApiService: IGoogleCalendarApiService,
    @Inject('ICalendarEventRepository')
    private readonly eventRepository: ICalendarEventRepository,
    @Optional()
    private readonly syncGateway?: CalendarSyncGateway,
    @Optional()
    private readonly metricsAdapter?: MetricsAdapter,
  ) {}

  /**
   * Perform full bidirectional synchronization between local and Google Calendar
   */
  async fullSync(
    userId: string,
    calendarId: string = 'primary',
  ): Promise<void> {
    this.logger.log(
      `Starting full sync for user ${userId}, calendar ${calendarId}`,
    );
    const startTime = Date.now();

    try {
      // Emit sync start status
      if (this.syncGateway) {
        this.syncGateway.emitSyncStatus(userId, {
          calendarId,
          status: 'syncing',
          progress: 0,
          message: 'Starting full sync...',
        });
      }

      // Step 1: Pull remote changes
      if (this.syncGateway) {
        this.syncGateway.emitSyncStatus(userId, {
          calendarId,
          status: 'syncing',
          progress: 25,
          message: 'Pulling remote changes...',
        });
      }
      await this.pullRemoteChanges(userId, calendarId);

      // Step 2: Push local changes
      if (this.syncGateway) {
        this.syncGateway.emitSyncStatus(userId, {
          calendarId,
          status: 'syncing',
          progress: 75,
          message: 'Pushing local changes...',
        });
      }
      await this.pushLocalChanges(userId, calendarId);

      // Step 3: Update sync state
      const syncKey = this.getSyncKey(userId, calendarId);
      const syncState: SyncState = {
        userId,
        calendarId,
        lastSyncTime: new Date(),
        status: 'idle',
      };
      this.syncStates.set(syncKey, syncState);

      const duration = Date.now() - startTime;
      const durationSeconds = duration / 1000;
      this.logger.log(
        `Full sync completed in ${duration}ms for user ${userId}`,
      );

      // Record metrics
      if (this.metricsAdapter) {
        this.metricsAdapter.incrementCalendarSync('success');
        this.metricsAdapter.recordCalendarSyncDuration(
          durationSeconds,
          'success',
        );
      }

      // Emit sync complete
      if (this.syncGateway) {
        this.syncGateway.emitSyncStatus(userId, {
          calendarId,
          status: 'idle',
          progress: 100,
          message: 'Sync completed',
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const durationSeconds = duration / 1000;
      const errorType =
        error instanceof Error ? error.constructor.name : 'UnknownError';

      // Record error metrics
      if (this.metricsAdapter) {
        this.metricsAdapter.incrementCalendarSync('error');
        this.metricsAdapter.recordCalendarSyncDuration(
          durationSeconds,
          'error',
        );
        this.metricsAdapter.incrementCalendarSyncErrors(errorType);
      }

      // Emit error status
      if (this.syncGateway) {
        this.syncGateway.emitSyncStatus(userId, {
          calendarId,
          status: 'error',
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
      this.logger.error(
        `Full sync failed for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Perform incremental sync using sync tokens (more efficient)
   */
  async incrementalSync(
    userId: string,
    calendarId: string = 'primary',
  ): Promise<void> {
    this.logger.log(
      `Starting incremental sync for user ${userId}, calendar ${calendarId}`,
    );
    const startTime = Date.now();

    try {
      const syncKey = this.getSyncKey(userId, calendarId);
      const syncState = this.syncStates.get(syncKey);

      if (!syncState?.lastSyncToken) {
        this.logger.warn(
          `No sync token found for ${syncKey}, falling back to full sync`,
        );
        await this.fullSync(userId, calendarId);
        return;
      }

      try {
        // Pull changes using sync token
        await this.pullRemoteChangesIncremental(
          userId,
          calendarId,
          syncState.lastSyncToken,
        );

        // Push local changes
        await this.pushLocalChanges(userId, calendarId);

        // Update sync state
        syncState.lastSyncTime = new Date();
        syncState.status = 'idle';
        this.syncStates.set(syncKey, syncState);

        const duration = Date.now() - startTime;
        this.logger.log(
          `Incremental sync completed in ${duration}ms for user ${userId}`,
        );
      } catch (error) {
        // Handle sync token expiration (410 Gone)
        if (error instanceof Error && error.message.includes('410')) {
          this.logger.warn(
            `Sync token expired for ${syncKey}, performing full sync`,
          );
          const newSyncState: SyncState = {
            userId,
            calendarId,
            lastSyncTime: syncState.lastSyncTime,
            status: 'idle',
          };
          this.syncStates.set(syncKey, newSyncState);
          await this.fullSync(userId, calendarId);
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(
        `Incremental sync failed for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Get sync state for a user's calendar
   */
  async getSyncState(
    userId: string,
    calendarId: string,
  ): Promise<SyncState | null> {
    const syncKey = this.getSyncKey(userId, calendarId);
    return this.syncStates.get(syncKey) || null;
  }

  /**
   * Resolve conflict between local and remote versions
   */
  resolveConflict(
    localEvent: CalendarEvent,
    remoteEvent: CalendarEvent,
    strategy: ConflictResolutionStrategy = this.strategy,
  ): CalendarEvent {
    this.logger.debug(
      `Resolving conflict for event ${localEvent.id} using ${strategy}`,
    );

    switch (strategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        return localEvent.updatedAt > remoteEvent.updatedAt
          ? localEvent
          : remoteEvent;

      case ConflictResolutionStrategy.LOCAL_WINS:
        return localEvent;

      case ConflictResolutionStrategy.REMOTE_WINS:
        return remoteEvent;

      case ConflictResolutionStrategy.USER_PROMPT:
        // Emit event via WebSocket for user resolution (but return default for now)
        if (this.syncGateway) {
          try {
            const conflictId = `conflict_${localEvent.id}_${Date.now()}`;
            const userId =
              (localEvent.metadata?.userId as string) ||
              (remoteEvent.metadata?.userId as string) ||
              'unknown';
            const calendarId = localEvent.calendarId || 'primary';

            this.logger.log(
              `Emitting conflict for user resolution ${conflictId}`,
            );

            // Fire and forget - just emit the conflict
            this.syncGateway
              .requestConflictResolution({
                conflictId,
                eventId: localEvent.id,
                localEvent,
                remoteEvent,
                userId,
                calendarId,
              })
              .catch((err: Error) => {
                this.logger.error(
                  `Failed to emit conflict resolution: ${err.message}`,
                );
              });

            // Fall back to LAST_WRITE_WINS for immediate resolution
            return localEvent.updatedAt > remoteEvent.updatedAt
              ? localEvent
              : remoteEvent;
          } catch (error) {
            this.logger.error(
              `Failed to emit conflict, falling back to LAST_WRITE_WINS:`,
              error instanceof Error ? error.message : String(error),
            );
            // Fallback to LAST_WRITE_WINS
            return localEvent.updatedAt > remoteEvent.updatedAt
              ? localEvent
              : remoteEvent;
          }
        } else {
          this.logger.warn(
            'USER_PROMPT strategy requires CalendarSyncGateway, using LAST_WRITE_WINS',
          );
          return localEvent.updatedAt > remoteEvent.updatedAt
            ? localEvent
            : remoteEvent;
        }

      default:
        this.logger.warn(`Unknown strategy ${strategy}, using LAST_WRITE_WINS`);
        return localEvent.updatedAt > remoteEvent.updatedAt
          ? localEvent
          : remoteEvent;
    }
  }

  /**
   * Reset sync state for a user's calendar
   */
  async resetSyncState(userId: string, calendarId: string): Promise<void> {
    const syncKey = this.getSyncKey(userId, calendarId);
    this.syncStates.delete(syncKey);
    this.logger.log(`Sync state reset for ${syncKey}`);
  }

  /**
   * Pull remote changes from Google Calendar
   */
  private async pullRemoteChanges(
    userId: string,
    calendarId: string,
  ): Promise<void> {
    const syncKey = this.getSyncKey(userId, calendarId);
    const syncState = this.syncStates.get(syncKey);
    const timeMin = syncState?.lastSyncTime;

    this.logger.debug(
      `Pulling remote changes for ${syncKey} since ${timeMin?.toISOString() || 'beginning'}`,
    );

    const remoteEvents = await this.calendarApiService.listEvents(calendarId, {
      maxResults: 2500,
      timeMin,
      singleEvents: true,
    });

    this.logger.debug(`Found ${remoteEvents.length} remote events`);

    let eventsSaved = 0;
    for (const remoteEvent of remoteEvents) {
      try {
        // Note: Deleted event handling would require Google Calendar API to support it
        // For now, we'll just process existing events

        // Check if event exists locally
        const localEvent = await this.eventRepository.findById(remoteEvent.id);

        if (!localEvent) {
          // New event - save to local
          await this.eventRepository.save(remoteEvent);
          eventsSaved++;
          this.logger.debug(
            `Saved new event ${remoteEvent.id} to local storage`,
          );
        } else {
          // Event exists - check for conflicts
          if (this.hasConflict(localEvent, remoteEvent)) {
            this.logger.debug(`Conflict detected for event ${remoteEvent.id}`);
            const resolved = this.resolveConflict(
              localEvent,
              remoteEvent,
              this.strategy,
            );
            await this.eventRepository.save(resolved);
            eventsSaved++;
            this.logger.debug(`Resolved and saved event ${remoteEvent.id}`);
          } else if (remoteEvent.updatedAt > localEvent.updatedAt) {
            // Remote is newer, no conflict
            await this.eventRepository.save(remoteEvent);
            eventsSaved++;
            this.logger.debug(`Updated event ${remoteEvent.id} from remote`);
          }
          // Otherwise local is newer or same - do nothing
        }
      } catch (error) {
        this.logger.error(
          `Failed to process remote event ${remoteEvent.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Record metrics
    if (this.metricsAdapter && eventsSaved > 0) {
      this.metricsAdapter.incrementCalendarEventsSynced(eventsSaved);
    }
  }

  /**
   * Pull remote changes incrementally using sync token
   */
  private async pullRemoteChangesIncremental(
    userId: string,
    calendarId: string,
    _syncToken: string,
  ): Promise<void> {
    this.logger.debug(`Pulling incremental changes with sync token`);

    // Note: The current API interface doesn't support syncToken parameter
    // In a real implementation, the IGoogleCalendarApiService would need to be extended
    // For now, fall back to full sync
    this.logger.warn(
      'Incremental sync with token not fully supported by current API interface',
    );
    await this.pullRemoteChanges(userId, calendarId);

    // Update sync token if provided in response
    const syncKey = this.getSyncKey(userId, calendarId);
    const syncState = this.syncStates.get(syncKey);
    if (syncState) {
      // In real implementation, extract nextSyncToken from API response
      // syncState.lastSyncToken = response.nextSyncToken;
      this.syncStates.set(syncKey, syncState);
    }
  }

  /**
   * Push local changes to Google Calendar
   */
  private async pushLocalChanges(
    userId: string,
    calendarId: string,
  ): Promise<void> {
    const syncKey = this.getSyncKey(userId, calendarId);
    const syncState = this.syncStates.get(syncKey);
    const since = syncState?.lastSyncTime;

    this.logger.debug(
      `Pushing local changes for ${syncKey} since ${since?.toISOString() || 'beginning'}`,
    );

    const localEvents = await this.eventRepository.findByUserId(userId);
    const modifiedEvents = since
      ? localEvents.filter((e) => e.updatedAt > since)
      : localEvents;

    this.logger.debug(`Found ${modifiedEvents.length} modified local events`);

    let eventsPushed = 0;
    for (const localEvent of modifiedEvents) {
      try {
        // Try to update remote event
        try {
          await this.calendarApiService.updateEvent(
            calendarId,
            localEvent.id,
            localEvent,
          );
          eventsPushed++;
          this.logger.debug(`Updated remote event ${localEvent.id}`);
        } catch (error) {
          // If event doesn't exist remotely (404), create it
          if (error instanceof Error && error.message.includes('404')) {
            await this.calendarApiService.createEvent(calendarId, localEvent);
            eventsPushed++;
            this.logger.debug(`Created remote event ${localEvent.id}`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to push event ${localEvent.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Record metrics
    if (this.metricsAdapter && eventsPushed > 0) {
      this.metricsAdapter.incrementCalendarEventsSynced(eventsPushed);
    }
  }

  /**
   * Check if there's a conflict between local and remote versions
   */
  private hasConflict(
    localEvent: CalendarEvent,
    remoteEvent: CalendarEvent,
  ): boolean {
    // Conflict exists if both have been modified since last sync
    // and their update times are within a small window (race condition)
    const timeDiff = Math.abs(
      localEvent.updatedAt.getTime() - remoteEvent.updatedAt.getTime(),
    );
    const CONFLICT_THRESHOLD_MS = 1000; // 1 second

    return (
      timeDiff < CONFLICT_THRESHOLD_MS &&
      localEvent.updatedAt !== remoteEvent.updatedAt
    );
  }

  /**
   * Generate sync key for state storage
   */
  private getSyncKey(userId: string, calendarId: string): string {
    return `${userId}:${calendarId}`;
  }
}
