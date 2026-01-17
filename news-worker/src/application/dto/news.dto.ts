/**
 * News DTOs
 *
 * Data Transfer Objects for news API requests and responses.
 */

import { IsOptional, IsString, IsNumber, IsArray, Min, Max } from 'class-validator';

export class GetNewsFeedDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class SearchNewsDto extends GetNewsFeedDto {
  @IsString()
  query!: string;
}

export class GetTrendingDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  category?: string;
}
