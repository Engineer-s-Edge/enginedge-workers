/**
 * Google Calendar Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  GoogleCalendarActor,
  GoogleCalendarArgs,
  GoogleCalendarOutput,
} from '@infrastructure/tools/actors/google-calendar.actor';

describe('GoogleCalendarActor', () => {
  let actor: GoogleCalendarActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleCalendarActor],
    }).compile();

    actor = module.get<GoogleCalendarActor>(GoogleCalendarActor);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('google-calendar-actor');
      expect(actor.description).toBe(
        'Provides integration with Google Calendar API for event management',
      );
    });

    it('should have correct category and auth requirements', () => {
      expect(actor.category).toBeDefined();
      expect(actor.requiresAuth).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should return error when access token is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'create-event',
        calendarId: 'primary',
        summary: 'Test Event',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Google Calendar access token is required',
      );
      expect(result.error?.name).toBe('AuthenticationError');
    });
  });

  describe('Create Event', () => {
    const validArgs: GoogleCalendarArgs = {
      operation: 'create-event',
      accessToken: 'test-access-token',
      calendarId: 'primary',
      summary: 'Team Meeting',
      description: 'Weekly team sync',
      startDateTime: '2024-01-15T10:00:00Z',
      endDateTime: '2024-01-15T11:00:00Z',
      timeZone: 'America/New_York',
      attendees: ['user1@example.com', 'user2@example.com'],
      location: 'Conference Room A',
    };

    it('should create an event successfully', async () => {
      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as GoogleCalendarOutput).operation).toBe(
        'create-event',
      );
      expect((result.output as GoogleCalendarOutput).eventId).toMatch(
        /^event-\d+$/,
      );
      expect((result.output as GoogleCalendarOutput).htmlLink).toContain(
        'https://calendar.google.com/calendar/event?eid=',
      );
    });

    it('should return error when calendarId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'create-event',
        accessToken: 'test-access-token',
        summary: 'Test Event',
        startDateTime: '2024-01-15T10:00:00Z',
        endDateTime: '2024-01-15T11:00:00Z',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID, summary, start time, and end time are required for event creation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when summary is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'create-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        startDateTime: '2024-01-15T10:00:00Z',
        endDateTime: '2024-01-15T11:00:00Z',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID, summary, start time, and end time are required for event creation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when startDateTime is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'create-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        summary: 'Test Event',
        endDateTime: '2024-01-15T11:00:00Z',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID, summary, start time, and end time are required for event creation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when endDateTime is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'create-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        summary: 'Test Event',
        startDateTime: '2024-01-15T10:00:00Z',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID, summary, start time, and end time are required for event creation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Update Event', () => {
    it('should update an event successfully', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'update-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        eventId: 'event-123',
        summary: 'Updated Meeting Title',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as GoogleCalendarOutput).operation).toBe(
        'update-event',
      );
      expect((result.output as GoogleCalendarOutput).eventId).toBe('event-123');
      expect((result.output as GoogleCalendarOutput).htmlLink).toContain(
        'https://calendar.google.com/calendar/event?eid=event-123',
      );
    });

    it('should return error when calendarId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'update-event',
        accessToken: 'test-access-token',
        eventId: 'event-123',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required for event update',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when eventId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'update-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required for event update',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Delete Event', () => {
    it('should delete an event successfully', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'delete-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        eventId: 'event-123',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as GoogleCalendarOutput).operation).toBe(
        'delete-event',
      );
      expect((result.output as GoogleCalendarOutput).deleted).toBe(true);
    });

    it('should return error when calendarId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'delete-event',
        accessToken: 'test-access-token',
        eventId: 'event-123',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required for event deletion',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when eventId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'delete-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required for event deletion',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Get Event', () => {
    it('should get an event successfully', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'get-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        eventId: 'event-123',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as GoogleCalendarOutput).operation).toBe(
        'get-event',
      );
      expect((result.output as GoogleCalendarOutput).event).toBeDefined();
      const event = (result.output as GoogleCalendarOutput).event as {
        id: string;
        summary: string;
      };
      expect(event.id).toBe('event-123');
      expect(event.summary).toBe('Sample Event');
    });

    it('should return error when calendarId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'get-event',
        accessToken: 'test-access-token',
        eventId: 'event-123',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when eventId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'get-event',
        accessToken: 'test-access-token',
        calendarId: 'primary',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID and event ID are required',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('List Events', () => {
    it('should list events successfully', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'list-events',
        accessToken: 'test-access-token',
        calendarId: 'primary',
        maxResults: 10,
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-12-31T23:59:59Z',
        q: 'meeting',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as GoogleCalendarOutput).operation).toBe(
        'list-events',
      );
      expect((result.output as GoogleCalendarOutput).events).toBeDefined();
      expect(
        Array.isArray((result.output as GoogleCalendarOutput).events),
      ).toBe(true);
      expect(
        (result.output as GoogleCalendarOutput).events!.length,
      ).toBeGreaterThan(0);
    });

    it('should return error when calendarId is missing', async () => {
      const args: GoogleCalendarArgs = {
        operation: 'list-events',
        accessToken: 'test-access-token',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Calendar ID is required for listing events',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unsupported operation', async () => {
      const args = {
        operation: 'invalid-operation' as unknown as 'create-event',
        accessToken: 'test-access-token',
      };

      const result = await actor.execute({
        name: 'google-calendar-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Unsupported operation: invalid-operation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });
});
