import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { GoogleAuthService } from '../auth/google-auth.service';
import { IGoogleCalendarApiService } from '../../../application/ports/google-calendar.port';
import { CalendarEvent, EventAttendee, EventReminder, EventRecurrence } from '../../../domain/entities';

/**
 * Google Calendar API Service
 * 
 * Handles all Google Calendar API operations (CRUD for events)
 * 
 * Infrastructure Adapter - Depends on googleapis library
 */
@Injectable()
export class GoogleCalendarApiService implements IGoogleCalendarApiService {
  private readonly logger = new Logger(GoogleCalendarApiService.name);
  private calendar: calendar_v3.Calendar;

  constructor(private readonly googleAuthService: GoogleAuthService) {
    const oauth2Client = this.googleAuthService.getOAuth2Client();
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.logger.log('GoogleCalendarApiService initialized');
  }

  /**
   * List events from a calendar
   */
  async listEvents(
    calendarId: string,
    options?: {
      maxResults?: number;
      timeMin?: Date;
      timeMax?: Date;
      singleEvents?: boolean;
      orderBy?: string;
    },
  ): Promise<CalendarEvent[]> {
    this.logger.log(`Listing events from calendar: ${calendarId}`);

    try {
      await this.googleAuthService.ensureValidTokens();

      const response = await this.calendar.events.list({
        calendarId,
        maxResults: options?.maxResults || 100,
        timeMin: options?.timeMin?.toISOString(),
        timeMax: options?.timeMax?.toISOString(),
        singleEvents: options?.singleEvents ?? true,
        orderBy: options?.orderBy || 'startTime',
      });

      const events = response.data.items || [];
      const mappedEvents = events
        .map((event) => this.mapGoogleEventToEntity(event, calendarId))
        .filter((event): event is CalendarEvent => event !== null);

      this.logger.log(
        `Successfully listed ${mappedEvents.length} events from calendar: ${calendarId}`,
      );

      return mappedEvents;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to list events from calendar: ${calendarId} - ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Get a single event
   */
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    this.logger.log(`Getting event: ${eventId} from calendar: ${calendarId}`);

    try {
      await this.googleAuthService.ensureValidTokens();

      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      const event = this.mapGoogleEventToEntity(response.data, calendarId);

      if (!event) {
        throw new Error(`Failed to map event: ${eventId}`);
      }

      this.logger.log(`Successfully retrieved event: ${eventId}`);
      return event;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get event: ${eventId} - ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string,
    event: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> {
    this.logger.log(`Creating event in calendar: ${calendarId}`);

    try {
      await this.googleAuthService.ensureValidTokens();

      const googleEvent = this.mapEntityToGoogleEvent(event);

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: googleEvent,
      });

      const createdEvent = this.mapGoogleEventToEntity(response.data, calendarId);

      if (!createdEvent) {
        throw new Error('Failed to map created event');
      }

      this.logger.log(`Successfully created event: ${createdEvent.id}`);
      return createdEvent;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to create event in calendar: ${calendarId} - ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> {
    this.logger.log(`Updating event: ${eventId} in calendar: ${calendarId}`);

    try {
      await this.googleAuthService.ensureValidTokens();

      const googleEvent = this.mapEntityToGoogleEvent(event);

      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: googleEvent,
      });

      const updatedEvent = this.mapGoogleEventToEntity(response.data, calendarId);

      if (!updatedEvent) {
        throw new Error('Failed to map updated event');
      }

      this.logger.log(`Successfully updated event: ${eventId}`);
      return updatedEvent;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to update event: ${eventId} - ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    this.logger.log(`Deleting event: ${eventId} from calendar: ${calendarId}`);

    try {
      await this.googleAuthService.ensureValidTokens();

      await this.calendar.events.delete({
        calendarId,
        eventId,
      });

      this.logger.log(`Successfully deleted event: ${eventId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to delete event: ${eventId} - ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Query free/busy information
   */
  async queryFreeBusy(
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<{ [calendarId: string]: { start: Date; end: Date }[] }> {
    this.logger.log(`Querying free/busy for ${calendarIds.length} calendars`);

    try {
      await this.googleAuthService.ensureValidTokens();

      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: calendarIds.map((id) => ({ id })),
        },
      });

      const result: { [calendarId: string]: { start: Date; end: Date }[] } = {};

      for (const calendarId of calendarIds) {
        const busySlots = response.data.calendars?.[calendarId]?.busy || [];
        result[calendarId] = busySlots.map((slot) => ({
          start: new Date(slot.start!),
          end: new Date(slot.end!),
        }));
      }

      this.logger.log('Successfully retrieved free/busy information');
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to query free/busy: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Batch create events
   */
  async batchCreateEvents(
    calendarId: string,
    events: Partial<CalendarEvent>[],
  ): Promise<CalendarEvent[]> {
    this.logger.log(
      `Batch creating ${events.length} events in calendar: ${calendarId}`,
    );

    const createdEvents: CalendarEvent[] = [];

    for (const event of events) {
      try {
        const created = await this.createEvent(calendarId, event);
        createdEvents.push(created);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Failed to create event in batch: ${err.message}`,
        );
        // Continue with next event
      }
    }

    this.logger.log(
      `Successfully created ${createdEvents.length}/${events.length} events`,
    );

    return createdEvents;
  }

  /**
   * Map Google Calendar event to domain entity
   */
  private mapGoogleEventToEntity(
    googleEvent: calendar_v3.Schema$Event,
    calendarId: string,
  ): CalendarEvent | null {
    try {
      // Skip events without required fields
      if (!googleEvent.id || !googleEvent.summary) {
        this.logger.warn('Skipping event without id or summary');
        return null;
      }

      // Parse start/end times
      const start = googleEvent.start?.dateTime || googleEvent.start?.date;
      const end = googleEvent.end?.dateTime || googleEvent.end?.date;

      if (!start || !end) {
        this.logger.warn(`Skipping event ${googleEvent.id} without start/end time`);
        return null;
      }

      // Map attendees
      const attendees: EventAttendee[] =
        googleEvent.attendees?.map((a) => ({
          email: a.email!,
          displayName: a.displayName || undefined,
          responseStatus: (a.responseStatus as 'needsAction' | 'declined' | 'tentative' | 'accepted') || 'needsAction',
          optional: a.optional || undefined,
        })) || [];

      // Map reminders
      const reminders: EventReminder[] =
        googleEvent.reminders?.overrides?.map((r) => ({
          method: r.method as 'email' | 'popup',
          minutes: r.minutes!,
        })) || [];

      // Map recurrence
      let recurrence: EventRecurrence | null = null;
      if (googleEvent.recurrence && googleEvent.recurrence.length > 0) {
        // Parse RRULE (simplified - full implementation would be more complex)
        const rrule = googleEvent.recurrence[0];
        if (rrule.includes('FREQ=DAILY')) {
          recurrence = { frequency: 'daily' };
        } else if (rrule.includes('FREQ=WEEKLY')) {
          recurrence = { frequency: 'weekly' };
        } else if (rrule.includes('FREQ=MONTHLY')) {
          recurrence = { frequency: 'monthly' };
        } else if (rrule.includes('FREQ=YEARLY')) {
          recurrence = { frequency: 'yearly' };
        }
      }

      return new CalendarEvent(
        googleEvent.id,
        calendarId,
        googleEvent.summary,
        googleEvent.description || null,
        new Date(start),
        new Date(end),
        googleEvent.location || null,
        attendees,
        reminders,
        recurrence,
        new Date(googleEvent.created!),
        new Date(googleEvent.updated!),
        'google',
        {
          htmlLink: googleEvent.htmlLink,
          hangoutLink: googleEvent.hangoutLink,
          conferenceData: googleEvent.conferenceData,
        },
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to map Google event to entity: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Map domain entity to Google Calendar event
   */
  private mapEntityToGoogleEvent(
    event: Partial<CalendarEvent>,
  ): calendar_v3.Schema$Event {
    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      start: event.startTime
        ? { dateTime: event.startTime.toISOString() }
        : undefined,
      end: event.endTime ? { dateTime: event.endTime.toISOString() } : undefined,
    };

    // Map attendees
    if (event.attendees && event.attendees.length > 0) {
      googleEvent.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
        optional: a.optional,
      }));
    }

    // Map reminders
    if (event.reminders && event.reminders.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: event.reminders.map((r) => ({
          method: r.method,
          minutes: r.minutes,
        })),
      };
    }

    // Map recurrence
    if (event.recurrence) {
      const rrule = `RRULE:FREQ=${event.recurrence.frequency.toUpperCase()}`;
      googleEvent.recurrence = [rrule];
    }

    return googleEvent;
  }
}
