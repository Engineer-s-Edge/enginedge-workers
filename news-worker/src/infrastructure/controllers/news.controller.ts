/**
 * News Controller
 *
 * HTTP API endpoints for news feed and article management.
 */

import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { NewsService } from '@application/services/news.service';
import { GetNewsFeedDto, SearchNewsDto, GetTrendingDto } from '@application/dto/news.dto';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * Get news feed
   * GET /news/feed
   */
  @Get('feed')
  @HttpCode(HttpStatus.OK)
  async getNewsFeed(@Query() query: GetNewsFeedDto) {
    const filters = {
      category: query.category,
      source: query.source,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      tags: query.tags,
    };

    return this.newsService.getNewsFeed(
      query.page || 1,
      query.pageSize || 20,
      filters,
    );
  }

  /**
   * Search articles
   * GET /news/search
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchArticles(@Query() query: SearchNewsDto) {
    const filters = {
      category: query.category,
      source: query.source,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      tags: query.tags,
    };

    return this.newsService.searchArticles(
      query.query,
      query.page || 1,
      query.pageSize || 20,
      filters,
    );
  }

  /**
   * Get trending articles
   * GET /news/trending
   */
  @Get('trending')
  @HttpCode(HttpStatus.OK)
  async getTrending(@Query() query: GetTrendingDto) {
    return this.newsService.getTrendingArticles(
      query.limit || 10,
      query.category,
    );
  }

  /**
   * Get article by ID
   * GET /news/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getArticle(@Param('id') id: string) {
    // This would use the repository directly
    // For now, return not implemented
    return {
      message: 'Get article by ID not yet implemented',
      id,
    };
  }
}
