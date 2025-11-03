/**
 * Google Calendar Retriever - Infrastructure Layer
 *
 * Searches Google Calendar for events using Google Calendar API v3.
 * Provides event search results with details, attendees, and scheduling information.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '../../../domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '../../../domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '../../../domain/entities/tool.entities';
import axios, { AxiosResponse } from 'axios';

export interface GoogleCalendarArgs {
  query?: string; // Search query for event titles, descriptions, or attendees
  calendar_id?: string; // Specific calendar ID, defaults to 'primary'
  time_min?: string; // ISO 8601 date/time for start of search range
  time_max?: string; // ISO 8601 date/time for end of search range
  max_results?: number; // Maximum number of events to return (default: 25, max: 2500)
  order_by?: 'startTime' | 'updated'; // Sort order
  single_events?: boolean; // Expand recurring events into individual instances
  show_deleted?: boolean; // Include deleted events
  time_zone?: string; // Time zone for response
  [key: string]: unknown; // Index signature for compatibility
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  created?: string;
  updated?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  recurrence?: string[];
  recurringEventId?: string;
  hangoutLink?: string;
  htmlLink?: string;
}

interface GoogleCalendarApiResponse {
  kind: string;
  etag: string;
  summary?: string;
  description?: string;
  updated?: string;
  timeZone?: string;
  accessRole?: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

export interface GoogleCalendarOutput extends ToolOutput {
  success: boolean;
  query?: string;
  calendar_id: string;
  time_min?: string;
  time_max?: string;
  total_events: number;
  next_page_token?: string;
  events: Array<{
    event_id: string;
    summary?: string;
    description?: string;
    location?: string;
    start_date_time?: string;
    start_date?: string;
    end_date_time?: string;
    end_date?: string;
    time_zone?: string;
    status: string;
    created?: string;
    updated?: string;
    creator?: {
      email?: string;
      display_name?: string;
    };
    organizer?: {
      email?: string;
      display_name?: string;
    };
    attendees?: Array<{
      email?: string;
      display_name?: string;
      response_status?: string;
    }>;
    is_recurring: boolean;
    recurring_event_id?: string;
    hangout_link?: string;
    html_link?: string;
  }>;
}

@Injectable()
export class GoogleCalendarRetriever extends BaseRetriever<
  GoogleCalendarArgs,
  GoogleCalendarOutput
> {
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query for event titles, descriptions, or attendees',
      },
      calendar_id: {
        type: 'string',
        description: 'Calendar ID to search (defaults to primary)',
        default: 'primary',
      },
      time_min: {
        type: 'string',
        description: 'ISO 8601 start time for search range',
        format: 'date-time',
      },
      time_max: {
        type: 'string',
        description: 'ISO 8601 end time for search range',
        format: 'date-time',
      },
      max_results: {
        type: 'number',
        description: 'Maximum events to return',
        minimum: 1,
        maximum: 2500,
        default: 25,
      },
      order_by: {
        type: 'string',
        enum: ['startTime', 'updated'],
        default: 'startTime',
      },
      single_events: {
        type: 'boolean',
        description: 'Expand recurring events',
        default: true,
      },
      time_zone: {
        type: 'string',
        description: 'Time zone for response',
      },
    },
    required: [],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      calendar_id: { type: 'string' },
      time_min: { type: 'string', format: 'date-time' },
      time_max: { type: 'string', format: 'date-time' },
      total_events: { type: 'number' },
      next_page_token: { type: 'string' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            event_id: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            location: { type: 'string' },
            start_date_time: { type: 'string', format: 'date-time' },
            start_date: { type: 'string', format: 'date' },
            end_date_time: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date' },
            time_zone: { type: 'string' },
            status: { type: 'string' },
            created: { type: 'string', format: 'date-time' },
            updated: { type: 'string', format: 'date-time' },
            is_recurring: { type: 'boolean' },
            hangout_link: { type: 'string' },
            html_link: { type: 'string' },
          },
        },
      },
    },
    required: ['success', 'calendar_id', 'total_events', 'events'],
  };

  readonly name = 'google-calendar-retriever';
  readonly description =
    'Search Google Calendar for events with comprehensive event details and scheduling information';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Google Calendar event search and retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent(
      'google-calendar-auth-failed',
      'Google Calendar authentication failed',
      false,
    ),
    new ErrorEvent(
      'google-calendar-api-error',
      'Google Calendar API request failed',
      true,
    ),
    new ErrorEvent(
      'google-calendar-invalid-calendar',
      'Invalid calendar ID provided',
      false,
    ),
    new ErrorEvent(
      'google-calendar-network-error',
      'Network connectivity issue with Google Calendar API',
      true,
    ),
  ];

  public get caching(): boolean {
    return false; // Calendar data changes frequently
  }

  protected async retrieve(
    args: GoogleCalendarArgs & { ragConfig: RAGConfig },
  ): Promise<GoogleCalendarOutput> {
    // Manual input validation
    if (args.time_min && !this.isValidISODate(args.time_min)) {
      throw new Error('Invalid time_min format - must be ISO 8601 date-time');
    }
    if (args.time_max && !this.isValidISODate(args.time_max)) {
      throw new Error('Invalid time_max format - must be ISO 8601 date-time');
    }
    if (args.max_results && (args.max_results < 1 || args.max_results > 2500)) {
      throw new Error('max_results must be between 1 and 2500');
    }

    const calendarId = args.calendar_id || 'primary';

    try {
      const response = await this.sendGoogleCalendarRequest(args, calendarId);

      return {
        success: true,
        query: args.query,
        calendar_id: calendarId,
        time_min: args.time_min,
        time_max: args.time_max,
        total_events: response.data.items?.length || 0,
        next_page_token: response.data.nextPageToken,
        events: this.transformEvents(response.data.items || []),
      };
    } catch (error: unknown) {
      return this.handleGoogleCalendarError(error);
    }
  }

  private async sendGoogleCalendarRequest(
    args: GoogleCalendarArgs,
    calendarId: string,
  ): Promise<AxiosResponse<GoogleCalendarApiResponse>> {
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Google access token not configured');
    }

    const params: Record<string, unknown> = {
      key: process.env.GOOGLE_API_KEY || '',
      singleEvents: args.single_events !== false, // Default to true
      orderBy: args.order_by || 'startTime',
      maxResults: Math.min(args.max_results || 25, 2500),
    };

    if (args.query) params.q = args.query;
    if (args.time_min) params.timeMin = args.time_min;
    if (args.time_max) params.timeMax = args.time_max;
    if (args.show_deleted !== undefined) params.showDeleted = args.show_deleted;
    if (args.time_zone) params.timeZone = args.time_zone;

    return axios.get<GoogleCalendarApiResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        params,
        timeout: 30000,
      },
    );
  }

  private transformEvents(
    events: GoogleCalendarEvent[],
  ): GoogleCalendarOutput['events'] {
    return events.map((event) => ({
      event_id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start_date_time: event.start.dateTime,
      start_date: event.start.date,
      end_date_time: event.end.dateTime,
      end_date: event.end.date,
      time_zone: event.start.timeZone || event.end.timeZone,
      status: event.status,
      created: event.created,
      updated: event.updated,
      creator: event.creator
        ? {
            email: event.creator.email,
            display_name: event.creator.displayName,
          }
        : undefined,
      organizer: event.organizer
        ? {
            email: event.organizer.email,
            display_name: event.organizer.displayName,
          }
        : undefined,
      attendees: event.attendees?.map((attendee) => ({
        email: attendee.email,
        display_name: attendee.displayName,
        response_status: attendee.responseStatus,
      })),
      is_recurring: !!(event.recurrence && event.recurrence.length > 0),
      recurring_event_id: event.recurringEventId,
      hangout_link: event.hangoutLink,
      html_link: event.htmlLink,
    }));
  }

  private handleGoogleCalendarError(error: unknown): GoogleCalendarOutput {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      if (status === 401 || status === 403) {
        // Authentication or authorization error
        throw new Error(
          'Google Calendar authentication failed - check access token',
        );
      } else if (status === 404) {
        // Calendar not found
        throw new Error(
          'Calendar not found - check calendar ID and permissions',
        );
      } else if (status === 429) {
        // Quota exceeded
        throw new Error('Google Calendar API quota exceeded - retry later');
      } else {
        // Other API error
        throw new Error(`Google Calendar API error: ${message}`);
      }
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('Google Calendar API request timeout');
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        throw new Error('Network connectivity issue with Google Calendar API');
      }
    }

    throw new Error(
      'Unknown error occurred while accessing Google Calendar API',
    );
  }

  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime()) && dateString === date.toISOString();
    } catch {
      return false;
    }
  }
}
