/**
 * Google Calendar Actor - Infrastructure Layer
 *
 * Provides integration with Google Calendar API for event management.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type GoogleCalendarOperation =
  | 'create-event'
  | 'update-event'
  | 'delete-event'
  | 'get-event'
  | 'list-events';

export interface GoogleCalendarArgs {
  operation: GoogleCalendarOperation;
  // Authentication
  accessToken?: string;
  refreshToken?: string;
  // For create-event
  calendarId?: string;
  summary?: string;
  description?: string;
  startDateTime?: string; // ISO 8601 format
  endDateTime?: string; // ISO 8601 format
  timeZone?: string;
  attendees?: string[]; // Email addresses
  location?: string;
  // For update-event/delete-event/get-event
  eventId?: string;
  // For list-events
  maxResults?: number;
  timeMin?: string; // ISO 8601 format
  timeMax?: string; // ISO 8601 format
  q?: string; // Free text search
}

export interface GoogleCalendarOutput extends ToolOutput {
  success: boolean;
  operation: GoogleCalendarOperation;
  // For create-event/update-event
  eventId?: string;
  htmlLink?: string;
  // For get-event
  event?: unknown;
  // For list-events
  events?: unknown[];
  nextPageToken?: string;
  // For delete-event
  deleted?: boolean;
}

@Injectable()
export class GoogleCalendarActor extends BaseActor<
  GoogleCalendarArgs,
  GoogleCalendarOutput
> {
  readonly name = 'google-calendar-actor';
  readonly description =
    'Provides integration with Google Calendar API for event management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_PRODUCTIVITY;
  }

  get requiresAuth(): boolean {
    return true;
  }

  constructor() {
    const errorEvents = [
      new ErrorEvent(
        'AuthenticationError',
        'Invalid or expired access token',
        false,
      ),
      new ErrorEvent('RateLimitError', 'API rate limit exceeded', true),
      new ErrorEvent('NetworkError', 'Network connectivity issue', true),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
    ];

    const metadata = new ActorConfig(
      'google-calendar-actor',
      'Google Calendar API integration',
      'Create, read, update, and delete Google Calendar events',
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'create-event',
              'update-event',
              'delete-event',
              'get-event',
              'list-events',
            ],
          },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          calendarId: { type: 'string' },
          summary: { type: 'string' },
          description: { type: 'string' },
          startDateTime: { type: 'string', format: 'date-time' },
          endDateTime: { type: 'string', format: 'date-time' },
          timeZone: { type: 'string' },
          attendees: {
            type: 'array',
            items: { type: 'string', format: 'email' },
          },
          location: { type: 'string' },
          eventId: { type: 'string' },
          maxResults: { type: 'number', minimum: 1, maximum: 2500 },
          timeMin: { type: 'string', format: 'date-time' },
          timeMax: { type: 'string', format: 'date-time' },
          q: { type: 'string' },
        },
        required: ['operation'],
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: {
            type: 'string',
            enum: [
              'create-event',
              'update-event',
              'delete-event',
              'get-event',
              'list-events',
            ],
          },
          eventId: { type: 'string' },
          htmlLink: { type: 'string', format: 'uri' },
          event: { type: 'object' },
          events: { type: 'array', items: { type: 'object' } },
          nextPageToken: { type: 'string' },
          deleted: { type: 'boolean' },
        },
        required: ['success', 'operation'],
      },
      [],
      ActorCategory.EXTERNAL_PRODUCTIVITY,
      true,
    );

    super(metadata, errorEvents);

    this.errorEvents = errorEvents;
    this.metadata = metadata;
  }

  protected async act(args: GoogleCalendarArgs): Promise<GoogleCalendarOutput> {
    // Validate authentication
    if (!args.accessToken) {
      throw Object.assign(
        new Error('Google Calendar access token is required'),
        {
          name: 'AuthenticationError',
        },
      );
    }

    switch (args.operation) {
      case 'create-event':
        return this.createEvent(args);
      case 'update-event':
        return this.updateEvent(args);
      case 'delete-event':
        return this.deleteEvent(args);
      case 'get-event':
        return this.getEvent(args);
      case 'list-events':
        return this.listEvents(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private async createEvent(
    args: GoogleCalendarArgs,
  ): Promise<GoogleCalendarOutput> {
    if (
      !args.calendarId ||
      !args.summary ||
      !args.startDateTime ||
      !args.endDateTime
    ) {
      throw Object.assign(
        new Error(
          'Calendar ID, summary, start time, and end time are required for event creation',
        ),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call - In real implementation, this would call Google Calendar API
      const eventId = `event-${Date.now()}`;
      const htmlLink = `https://calendar.google.com/calendar/event?eid=${eventId}`;

      return {
        success: true,
        operation: 'create-event',
        eventId,
        htmlLink,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async updateEvent(
    args: GoogleCalendarArgs,
  ): Promise<GoogleCalendarOutput> {
    if (!args.calendarId || !args.eventId) {
      throw Object.assign(
        new Error('Calendar ID and event ID are required for event update'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      const htmlLink = `https://calendar.google.com/calendar/event?eid=${args.eventId}`;

      return {
        success: true,
        operation: 'update-event',
        eventId: args.eventId,
        htmlLink,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async deleteEvent(
    args: GoogleCalendarArgs,
  ): Promise<GoogleCalendarOutput> {
    if (!args.calendarId || !args.eventId) {
      throw Object.assign(
        new Error('Calendar ID and event ID are required for event deletion'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'delete-event',
        deleted: true,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getEvent(
    args: GoogleCalendarArgs,
  ): Promise<GoogleCalendarOutput> {
    if (!args.calendarId || !args.eventId) {
      throw Object.assign(new Error('Calendar ID and event ID are required'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      const mockEvent = {
        id: args.eventId,
        summary: 'Sample Event',
        description: 'This is a sample event',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' },
        attendees: [],
        location: 'Conference Room A',
      };

      return {
        success: true,
        operation: 'get-event',
        event: mockEvent,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async listEvents(
    args: GoogleCalendarArgs,
  ): Promise<GoogleCalendarOutput> {
    if (!args.calendarId) {
      throw Object.assign(
        new Error('Calendar ID is required for listing events'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      const mockEvents = [
        {
          id: 'event-1',
          summary: 'Team Meeting',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
        },
        {
          id: 'event-2',
          summary: 'Project Review',
          start: { dateTime: '2024-01-16T14:00:00Z' },
          end: { dateTime: '2024-01-16T15:30:00Z' },
        },
      ];

      return {
        success: true,
        operation: 'list-events',
        events: mockEvents,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): Error {
    // In a real implementation, this would parse Google Calendar API errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown API error';

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return Object.assign(new Error('Invalid or expired access token'), {
        name: 'AuthenticationError',
      });
    }

    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return Object.assign(new Error('API rate limit exceeded'), {
        name: 'RateLimitError',
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return Object.assign(new Error('Network connectivity issue'), {
        name: 'NetworkError',
      });
    }

    return Object.assign(
      new Error(`Google Calendar API error: ${errorMessage}`),
      {
        name: 'ApiError',
      },
    );
  }
}
