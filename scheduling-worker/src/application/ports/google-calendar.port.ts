/**
 * Application Ports - Interfaces for external dependencies
 *
 * These are implemented in the infrastructure layer
 */

import { CalendarEvent } from '../../domain/entities';

/**
 * OAuth tokens for Google Calendar
 */
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

/**
 * Google Auth Port - Interface for OAuth operations
 */
export interface IGoogleAuthService {
  /**
   * Generate the OAuth authorization URL
   */
  generateAuthUrl(): string;

  /**
   * Exchange authorization code for tokens
   */
  getTokenFromCode(code: string): Promise<GoogleOAuthTokens>;

  /**
   * Set credentials for API calls
   */
  setCredentials(tokens: GoogleOAuthTokens): void;

  /**
   * Get current credentials
   */
  getCredentials(): GoogleOAuthTokens | null;

  /**
   * Refresh the access token
   */
  refreshAccessToken(): Promise<GoogleOAuthTokens>;

  /**
   * Revoke tokens
   */
  revokeToken(token: string): Promise<void>;
}

/**
 * Google Calendar API Port - Interface for calendar operations
 */
export interface IGoogleCalendarApiService {
  /**
   * List events from a calendar
   */
  listEvents(
    calendarId: string,
    options?: {
      maxResults?: number;
      timeMin?: Date;
      timeMax?: Date;
      singleEvents?: boolean;
      orderBy?: string;
    },
  ): Promise<CalendarEvent[]>;

  /**
   * Get a single event
   */
  getEvent(calendarId: string, eventId: string): Promise<CalendarEvent>;

  /**
   * Create a new event
   */
  createEvent(
    calendarId: string,
    event: Partial<CalendarEvent>,
  ): Promise<CalendarEvent>;

  /**
   * Update an existing event
   */
  updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>,
  ): Promise<CalendarEvent>;

  /**
   * Delete an event
   */
  deleteEvent(calendarId: string, eventId: string): Promise<void>;

  /**
   * Query free/busy information
   */
  queryFreeBusy(
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<{ [calendarId: string]: { start: Date; end: Date }[] }>;

  /**
   * Batch create events
   */
  batchCreateEvents(
    calendarId: string,
    events: Partial<CalendarEvent>[],
  ): Promise<CalendarEvent[]>;

  /**
   * Create a locked time block (immutable event)
   */
  createLockedBlock(
    calendarId: string,
    summary: string,
    startDateTime: string,
    endDateTime: string,
    description?: string,
  ): Promise<CalendarEvent>;

  /**
   * Enhanced update with time validation and overlap checking
   */
  updateEventEnhanced(
    calendarId: string,
    eventId: string,
    eventData: Partial<CalendarEvent>,
    newStartTime?: string,
    newEndTime?: string,
  ): Promise<CalendarEvent>;

  /**
   * Check if an event is locked (immutable)
   */
  isEventLocked(event: CalendarEvent): boolean;

  /**
   * Check for overlaps with locked blocks
   */
  checkOverlapWithLockedBlocks(
    start: Date,
    end: Date,
    allEvents: CalendarEvent[],
  ): { overlaps: boolean; lockedEvent?: CalendarEvent };
}

/**
 * Calendar Sync State
 */
export interface SyncState {
  userId: string;
  calendarId: string;
  lastSyncToken?: string;
  lastSyncTime: Date;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

/**
 * Calendar Sync Port - Interface for bidirectional sync
 */
export interface ICalendarSyncService {
  /**
   * Perform full sync
   */
  fullSync(userId: string, calendarId: string): Promise<void>;

  /**
   * Perform incremental sync (delta)
   */
  incrementalSync(userId: string, calendarId: string): Promise<void>;

  /**
   * Get sync state
   */
  getSyncState(userId: string, calendarId: string): Promise<SyncState | null>;

  /**
   * Resolve conflicts between local and remote events
   */
  resolveConflict(
    localEvent: CalendarEvent,
    remoteEvent: CalendarEvent,
  ): CalendarEvent;
}
