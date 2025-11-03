import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  IGoogleAuthService,
  IGoogleCalendarApiService,
} from '../../application/ports/google-calendar.port';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';

/**
 * Calendar Controller
 *
 * REST API endpoints for Google Calendar integration
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly googleAuthService: IGoogleAuthService,
    private readonly googleCalendarService: IGoogleCalendarApiService,
  ) {
    this.logger.log('CalendarController initialized');
  }

  /**
   * Get OAuth authorization URL
   */
  @Get('auth/url')
  @ApiOperation({ summary: 'Get Google Calendar OAuth URL' })
  @ApiResponse({ status: 200, description: 'OAuth URL generated' })
  getAuthUrl(): { authUrl: string } {
    this.logger.log('Generating auth URL');
    const authUrl = this.googleAuthService.generateAuthUrl();
    return { authUrl };
  }

  /**
   * Handle OAuth callback
   */
  @Post('auth/callback')
  @ApiOperation({ summary: 'Handle OAuth callback' })
  @ApiResponse({ status: 200, description: 'Tokens retrieved' })
  async handleCallback(@Body('code') code: string) {
    this.logger.log('Handling OAuth callback');
    const tokens = await this.googleAuthService.getTokenFromCode(code);
    this.googleAuthService.setCredentials(tokens);
    return { success: true, tokens };
  }

  /**
   * List calendar events
   */
  @Get('events')
  @ApiOperation({ summary: 'List calendar events' })
  @ApiQuery({ name: 'calendarId', required: false, example: 'primary' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  @ApiQuery({ name: 'timeMin', required: false, type: String })
  @ApiQuery({ name: 'timeMax', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Events retrieved' })
  async listEvents(
    @Query('calendarId') calendarId = 'primary',
    @Query('maxResults') maxResults?: number,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    this.logger.log(`Listing events for calendar: ${calendarId}`);

    const options: { maxResults?: number; timeMin?: Date; timeMax?: Date } = {
      maxResults,
    };
    if (timeMin) options.timeMin = new Date(timeMin);
    if (timeMax) options.timeMax = new Date(timeMax);

    const events = await this.googleCalendarService.listEvents(
      calendarId,
      options,
    );
    return { events };
  }

  /**
   * Get single event
   */
  @Get('events/:eventId')
  @ApiOperation({ summary: 'Get a single event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiQuery({ name: 'calendarId', required: false, example: 'primary' })
  @ApiResponse({ status: 200, description: 'Event retrieved' })
  async getEvent(
    @Param('eventId') eventId: string,
    @Query('calendarId') calendarId = 'primary',
  ) {
    this.logger.log(`Getting event: ${eventId}`);
    const event = await this.googleCalendarService.getEvent(
      calendarId,
      eventId,
    );
    return { event };
  }

  /**
   * Create a new event
   */
  @Post('events')
  @ApiOperation({ summary: 'Create a new calendar event' })
  @ApiResponse({ status: 201, description: 'Event created' })
  async createEvent(
    @Body() eventData: Partial<CalendarEvent>,
    @Query('calendarId') calendarId = 'primary',
  ) {
    this.logger.log(`Creating event in calendar: ${calendarId}`);
    const event = await this.googleCalendarService.createEvent(
      calendarId,
      eventData,
    );
    return { event };
  }

  /**
   * Update an event
   */
  @Put('events/:eventId')
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event updated' })
  async updateEvent(
    @Param('eventId') eventId: string,
    @Body() eventData: Partial<CalendarEvent>,
    @Query('calendarId') calendarId = 'primary',
  ) {
    this.logger.log(`Updating event: ${eventId}`);
    const event = await this.googleCalendarService.updateEvent(
      calendarId,
      eventId,
      eventData,
    );
    return { event };
  }

  /**
   * Delete an event
   */
  @Delete('events/:eventId')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event deleted' })
  async deleteEvent(
    @Param('eventId') eventId: string,
    @Query('calendarId') calendarId = 'primary',
  ) {
    this.logger.log(`Deleting event: ${eventId}`);
    await this.googleCalendarService.deleteEvent(calendarId, eventId);
    return { success: true };
  }

  /**
   * Query free/busy times
   */
  @Post('freebusy')
  @ApiOperation({ summary: 'Query free/busy information' })
  @ApiResponse({ status: 200, description: 'Free/busy data retrieved' })
  async queryFreeBusy(
    @Body()
    data: {
      calendarIds: string[];
      timeMin: string;
      timeMax: string;
    },
  ) {
    this.logger.log(
      `Querying free/busy for ${data.calendarIds.length} calendars`,
    );

    const result = await this.googleCalendarService.queryFreeBusy(
      data.calendarIds,
      new Date(data.timeMin),
      new Date(data.timeMax),
    );

    return { result };
  }
}
