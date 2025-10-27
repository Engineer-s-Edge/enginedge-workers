/**
 * Weather Retriever - Infrastructure Layer
 *
 * Retrieves weather data from weather APIs for locations.
 * Provides current weather, forecasts, and historical data.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';
import axios, { AxiosResponse } from 'axios';

export interface WeatherArgs {
  location: string;
  type?: 'current' | 'forecast' | 'historical';
  units?: 'metric' | 'imperial' | 'kelvin';
  days?: number;
  date?: string; // For historical data: YYYY-MM-DD
  include_hourly?: boolean;
  include_alerts?: boolean;
  language?: string;
  [key: string]: unknown; // Index signature for compatibility
}

export interface WeatherOutput extends ToolOutput {
  success: boolean;
  location: string;
  type: string;
  units: string;
  current?: {
    temperature: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    wind_speed: number;
    wind_direction: number;
    wind_gust?: number;
    visibility: number;
    uv_index: number;
    cloud_cover: number;
    condition: string;
    icon: string;
    last_updated: string;
  };
  forecast?: Array<{
    date: string;
    max_temp: number;
    min_temp: number;
    avg_temp: number;
    condition: string;
    icon: string;
    chance_of_rain: number;
    chance_of_snow: number;
    precipitation: number;
    humidity: number;
    wind_speed: number;
    wind_direction: number;
    uv_index: number;
    sunrise?: string;
    sunset?: string;
    hourly?: Array<{
      time: string;
      temperature: number;
      condition: string;
      chance_of_rain: number;
      wind_speed: number;
    }>;
  }>;
  alerts?: Array<{
    headline: string;
    message: string;
    severity: string;
    urgency: string;
    areas: string;
    effective: string;
    expires: string;
  }>;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class WeatherRetriever extends BaseRetriever<WeatherArgs, WeatherOutput> {
  readonly name = 'weather-retriever';
  readonly description = 'Retrieve weather data including current conditions, forecasts, and historical weather for any location';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;
  readonly caching = false;

  readonly inputSchema = {
    type: 'object',
    required: ['location'],
    properties: {
      location: {
        type: 'string',
        description: 'Location for weather data (city name, coordinates, or address)',
        minLength: 1,
        maxLength: 100
      },
      type: {
        type: 'string',
        enum: ['current', 'forecast', 'historical'],
        description: 'Type of weather data to retrieve',
        default: 'current'
      },
      units: {
        type: 'string',
        enum: ['metric', 'imperial', 'kelvin'],
        description: 'Temperature units for the response',
        default: 'metric'
      },
      days: {
        type: 'number',
        description: 'Number of forecast days (1-14)',
        minimum: 1,
        maximum: 14,
        default: 7
      },
      date: {
        type: 'string',
        description: 'Date for historical data (YYYY-MM-DD format)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      include_hourly: {
        type: 'boolean',
        description: 'Include hourly forecast data',
        default: false
      },
      include_alerts: {
        type: 'boolean',
        description: 'Include weather alerts and warnings',
        default: false
      },
      language: {
        type: 'string',
        description: 'Language for weather descriptions',
        default: 'en'
      }
    }
  };

  readonly outputSchema = {
    type: 'object',
    required: ['success', 'location', 'type', 'units'],
    properties: {
      success: { type: 'boolean' },
      location: { type: 'string' },
      type: { type: 'string' },
      units: { type: 'string' },
      current: {
        type: 'object',
        properties: {
          temperature: { type: 'number' },
          feels_like: { type: 'number' },
          humidity: { type: 'number' },
          pressure: { type: 'number' },
          wind_speed: { type: 'number' },
          wind_direction: { type: 'number' },
          wind_gust: { type: 'number' },
          visibility: { type: 'number' },
          uv_index: { type: 'number' },
          cloud_cover: { type: 'number' },
          condition: { type: 'string' },
          icon: { type: 'string' },
          last_updated: { type: 'string' }
        }
      },
      forecast: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            max_temp: { type: 'number' },
            min_temp: { type: 'number' },
            avg_temp: { type: 'number' },
            condition: { type: 'string' },
            icon: { type: 'string' },
            chance_of_rain: { type: 'number' },
            chance_of_snow: { type: 'number' },
            precipitation: { type: 'number' },
            humidity: { type: 'number' },
            wind_speed: { type: 'number' },
            wind_direction: { type: 'number' },
            uv_index: { type: 'number' },
            sunrise: { type: 'string' },
            sunset: { type: 'string' }
          }
        }
      },
      alerts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            message: { type: 'string' },
            severity: { type: 'string' },
            urgency: { type: 'string' },
            areas: { type: 'string' },
            effective: { type: 'string' },
            expires: { type: 'string' }
          }
        }
      },
      processingTime: { type: 'number' },
      message: { type: 'string' }
    }
  };

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Weather data retrieval and forecasting',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {}
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent('weather-service-unavailable', 'Weather service is not available', false),
    new ErrorEvent('weather-location-not-found', 'Weather location not found', false),
    new ErrorEvent('weather-invalid-request', 'Invalid weather request parameters', false),
    new ErrorEvent('weather-api-error', 'Weather API returned an error', true)
  ];

  protected async retrieve(args: WeatherArgs & { ragConfig: RAGConfig }): Promise<WeatherOutput> {
    // Validate input
    this.validateInput(args);

    const {
      location,
      type = 'current',
      units = 'metric',
      days = 7,
      date,
      include_hourly = false,
      include_alerts = false,
      language = 'en'
    } = args;

    // Validate location
    if (!location || location.trim().length === 0) {
      throw Object.assign(new Error('Location cannot be empty'), {
        name: 'ValidationError'
      });
    }

    if (location.length > 100) {
      throw Object.assign(new Error('Location too long (max 100 characters)'), {
        name: 'ValidationError'
      });
    }

    // Validate date format for historical data
    if (type === 'historical' && date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw Object.assign(new Error('Date must be in YYYY-MM-DD format'), {
          name: 'ValidationError'
        });
      }
    }

    // Send request to weather API
    return await this.sendWeatherRequest({
      location: location.trim(),
      type,
      units,
      days,
      date,
      include_hourly,
      include_alerts,
      language
    });
  }

  private async sendWeatherRequest(request: {
    location: string;
    type: string;
    units: string;
    days: number;
    date?: string;
    include_hourly: boolean;
    include_alerts: boolean;
    language: string;
  }): Promise<WeatherOutput> {
    try {
      // Make HTTP call to weather API (using WeatherAPI as example)
      const params: Record<string, string | number | boolean> = {
        key: process.env.WEATHER_API_KEY || '',
        q: request.location,
        lang: request.language
      };

      let endpoint = 'current.json';
      if (request.type === 'forecast') {
        endpoint = 'forecast.json';
        params.days = request.days;
        if (request.include_hourly) {
          params.hour = 24; // Include hourly data
        }
        if (request.include_alerts) {
          params.alerts = 'yes';
        }
      } else if (request.type === 'historical' && request.date) {
        endpoint = 'history.json';
        params.dt = request.date;
      }

      const response: AxiosResponse = await axios.get(
        `http://api.weatherapi.com/v1/${endpoint}`,
        {
          params,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.status === 200) {
        // Transform WeatherAPI response to our format
        const result: WeatherOutput = {
          success: true,
          location: request.location,
          type: request.type,
          units: request.units
        };

        if (request.type === 'current' && response.data.current) {
          result.current = this.transformCurrentWeather(response.data.current, request.units);
        }

        if (request.type === 'forecast' && response.data.forecast) {
          result.forecast = this.transformForecast(response.data.forecast.forecastday, request.units, request.include_hourly);
        }

        if (request.include_alerts && response.data.alerts) {
          result.alerts = this.transformAlerts(response.data.alerts.alert);
        }

        return result;
      } else {
        return {
          success: false,
          location: request.location,
          type: request.type,
          units: request.units,
          message: 'Weather request failed'
        };
      }

    } catch (error) {
      const axiosError = error as {
        code?: string;
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string
      };

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw Object.assign(new Error('Weather service is not available'), {
          name: 'ServiceUnavailableError'
        });
      }

      if (axiosError.response?.status === 408 || axiosError.code === 'ETIMEDOUT') {
        throw Object.assign(new Error('Weather request timed out'), {
          name: 'TimeoutError'
        });
      }

      if (axiosError.response?.status === 401) {
        throw Object.assign(new Error('Weather API key is invalid or missing'), {
          name: 'AuthenticationError'
        });
      }

      if (axiosError.response?.status === 400) {
        throw Object.assign(new Error('Weather location not found'), {
          name: 'LocationNotFoundError'
        });
      }

      const errorMessage = axiosError.response?.data?.error?.message ||
                          axiosError.message ||
                          'Unknown error';
      throw Object.assign(new Error(`Weather request failed: ${errorMessage}`), {
        name: 'WeatherError'
      });
    }
  }

  private transformCurrentWeather(current: Record<string, unknown>, units: string): WeatherOutput['current'] {
    const data = current as any;
    return {
      temperature: data.temp_c || data.temp_f || data.temp_k || 0,
      feels_like: data.feelslike_c || data.feelslike_f || data.feelslike_k || 0,
      humidity: data.humidity || 0,
      pressure: data.pressure_mb || data.pressure_in || 0,
      wind_speed: data.wind_kph || data.wind_mph || 0,
      wind_direction: data.wind_degree || 0,
      wind_gust: data.gust_kph || data.gust_mph,
      visibility: data.vis_km || data.vis_miles || 0,
      uv_index: data.uv || 0,
      cloud_cover: data.cloud || 0,
      condition: data.condition?.text || '',
      icon: data.condition?.icon || '',
      last_updated: data.last_updated || ''
    };
  }

  private transformForecast(forecastDays: Record<string, unknown>[], units: string, includeHourly: boolean): WeatherOutput['forecast'] {
    return forecastDays.map(day => {
      const data = day as any;
      return {
        date: data.date || '',
        max_temp: data.day?.maxtemp_c || data.day?.maxtemp_f || 0,
        min_temp: data.day?.mintemp_c || data.day?.mintemp_f || 0,
        avg_temp: data.day?.avgtemp_c || data.day?.avgtemp_f || 0,
        condition: data.day?.condition?.text || '',
        icon: data.day?.condition?.icon || '',
        chance_of_rain: data.day?.daily_chance_of_rain || 0,
        chance_of_snow: data.day?.daily_chance_of_snow || 0,
        precipitation: data.day?.totalprecip_mm || data.day?.totalprecip_in || 0,
        humidity: data.day?.avghumidity || 0,
        wind_speed: data.day?.maxwind_kph || data.day?.maxwind_mph || 0,
        wind_direction: data.day?.wind_degree || 0,
        uv_index: data.day?.uv || 0,
        sunrise: data.astro?.sunrise,
        sunset: data.astro?.sunset,
        hourly: includeHourly ? data.hour?.map((hour: any) => ({
          time: hour.time || '',
          temperature: hour.temp_c || hour.temp_f || 0,
          condition: hour.condition?.text || '',
          chance_of_rain: hour.chance_of_rain || 0,
          wind_speed: hour.wind_kph || hour.wind_mph || 0
        })) : undefined
      };
    });
  }

  private transformAlerts(alerts: Record<string, unknown>[]): WeatherOutput['alerts'] {
    return alerts?.map(alert => {
      const data = alert as any;
      return {
        headline: data.headline || '',
        message: data.msg || '',
        severity: data.severity || 'Unknown',
        urgency: data.urgency || 'Unknown',
        areas: data.areas || '',
        effective: data.effective || '',
        expires: data.expires || ''
      };
    }) || [];
  }
}