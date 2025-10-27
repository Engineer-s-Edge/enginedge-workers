/**
 * YouTube Retriever - Unit Tests
 *
 * Comprehensive test suite for YouTube Retriever implementation.
 * Tests cover all functionality including error handling and edge cases.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { YouTubeRetriever } from '@infrastructure/tools/retrievers/youtube.retriever';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('YouTubeRetriever', () => {
  let retriever: YouTubeRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YouTubeRetriever],
    }).compile();

    retriever = module.get<YouTubeRetriever>(YouTubeRetriever);

    // Reset all mocks
    jest.clearAllMocks();

    // Set up environment variable
    process.env.YOUTUBE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('youtube-retriever');
      expect(retriever.description).toContain('Search YouTube for videos, channels, and playlists');
      expect(retriever.retrievalType).toBe('VIDEO_TRANSCRIPT');
      expect(retriever.caching).toBe(false);
    });

    it('should have valid metadata', () => {
      const metadata = retriever.metadata;
      expect(metadata.name).toBe('youtube-retriever');
      expect(metadata.description).toContain('Search YouTube for videos, channels, and playlists');
    });

    it('should have proper error events', () => {
      const errorEvents = retriever.errorEvents;
      expect(errorEvents).toHaveLength(4);
      expect(errorEvents.map(e => e.name)).toEqual([
        'youtube-service-unavailable',
        'youtube-search-failed',
        'youtube-invalid-query',
        'youtube-api-quota-exceeded'
      ]);
    });
  });

  describe('Input Validation', () => {
    it('should reject empty query', async () => {
      const call = {
        name: 'youtube-retriever',
        args: { query: '' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Search query cannot be empty');
    });

    it('should reject query that is only whitespace', async () => {
      const call = {
        name: 'youtube-retriever',
        args: { query: '   ' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Search query cannot be empty');
    });

    it('should reject query longer than 500 characters', async () => {
      const longQuery = 'a'.repeat(501);
      const call = {
        name: 'youtube-retriever',
        args: { query: longQuery }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Search query too long (max 500 characters)');
    });

    it('should accept valid query', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');
    });
  });

  describe('API Request Construction', () => {
    it('should construct basic search request correctly', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'test-api-key',
            q: 'test search',
            part: 'snippet',
            maxResults: 25,
            order: 'relevance',
            type: 'video',
            safeSearch: 'moderate'
          }),
          timeout: 30000
        })
      );
    });

    it('should include all optional parameters when provided', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: {
          query: 'test search',
          max_results: 10,
          order: 'date',
          type: 'channel',
          published_after: '2023-01-01T00:00:00Z',
          published_before: '2023-12-31T23:59:59Z',
          region_code: 'US',
          relevance_language: 'en',
          safe_search: 'strict',
          video_definition: 'high',
          video_duration: 'long',
          channel_id: 'UC123456789'
        }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'test-api-key',
            q: 'test search',
            part: 'snippet',
            maxResults: 10,
            order: 'date',
            type: 'channel',
            publishedAfter: '2023-01-01T00:00:00Z',
            publishedBefore: '2023-12-31T23:59:59Z',
            regionCode: 'US',
            relevanceLanguage: 'en',
            safeSearch: 'strict',
            channelId: 'UC123456789'
          })
        })
      );
    });

    it('should trim query whitespace', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: '  test search  ' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'test search'
          })
        })
      );
    });
  });

  describe('Successful API Responses', () => {
    it('should transform video search results correctly', async () => {
      const mockResponse = {
        data: {
          pageInfo: {
            totalResults: 100,
            resultsPerPage: 25
          },
          nextPageToken: 'next-token',
          prevPageToken: 'prev-token',
          items: [
            {
              id: { videoId: 'video123' },
              snippet: {
                title: 'Test Video',
                description: 'Test description',
                channelTitle: 'Test Channel',
                channelId: 'channel123',
                publishedAt: '2023-01-01T00:00:00Z',
                thumbnails: {
                  default: { url: 'thumb1.jpg', width: 120, height: 90 },
                  medium: { url: 'thumb2.jpg', width: 320, height: 180 }
                }
              }
            }
          ]
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.query).toBe('test search');
      expect(result.output!.total_results).toBe(100);
      expect(result.output!.results_per_page).toBe(25);
      expect(result.output!.next_page_token).toBe('next-token');
      expect(result.output!.prev_page_token).toBe('prev-token');
      expect(result.output!.videos).toHaveLength(1);
      expect(result.output!.videos![0]).toEqual({
        video_id: 'video123',
        title: 'Test Video',
        description: 'Test description',
        channel_title: 'Test Channel',
        channel_id: 'channel123',
        published_at: '2023-01-01T00:00:00Z',
        thumbnails: {
          default: { url: 'thumb1.jpg', width: 120, height: 90 },
          medium: { url: 'thumb2.jpg', width: 320, height: 180 }
        }
      });
    });

    it('should transform channel search results correctly', async () => {
      const mockResponse = {
        data: {
          pageInfo: { totalResults: 50, resultsPerPage: 10 },
          items: [
            {
              id: { channelId: 'channel123' },
              snippet: {
                title: 'Test Channel',
                description: 'Channel description',
                publishedAt: '2023-01-01T00:00:00Z',
                thumbnails: {
                  default: { url: 'thumb1.jpg', width: 88, height: 88 }
                }
              }
            }
          ]
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test channel', type: 'channel' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.channels).toHaveLength(1);
      expect(result.output!.channels![0]).toEqual({
        channel_id: 'channel123',
        title: 'Test Channel',
        description: 'Channel description',
        published_at: '2023-01-01T00:00:00Z',
        thumbnails: {
          default: { url: 'thumb1.jpg', width: 88, height: 88 }
        }
      });
    });

    it('should transform playlist search results correctly', async () => {
      const mockResponse = {
        data: {
          pageInfo: { totalResults: 25, resultsPerPage: 5 },
          items: [
            {
              id: { playlistId: 'playlist123' },
              snippet: {
                title: 'Test Playlist',
                description: 'Playlist description',
                channelTitle: 'Test Channel',
                channelId: 'channel123',
                publishedAt: '2023-01-01T00:00:00Z',
                thumbnails: {
                  default: { url: 'thumb1.jpg', width: 120, height: 90 }
                }
              }
            }
          ]
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test playlist', type: 'playlist' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.playlists).toHaveLength(1);
      expect(result.output!.playlists![0]).toEqual({
        playlist_id: 'playlist123',
        title: 'Test Playlist',
        description: 'Playlist description',
        channel_title: 'Test Channel',
        channel_id: 'channel123',
        published_at: '2023-01-01T00:00:00Z',
        thumbnails: {
          default: { url: 'thumb1.jpg', width: 120, height: 90 }
        }
      });
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        data: {
          pageInfo: { totalResults: 0, resultsPerPage: 25 },
          items: []
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'no results query' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.total_results).toBe(0);
      expect(result.output!.videos).toEqual([]);
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockResponse = {
        data: {
          pageInfo: { totalResults: 1, resultsPerPage: 25 },
          items: [
            {
              id: { videoId: 'video123' },
              snippet: {
                title: 'Test Video'
                // Missing description, channelTitle, etc.
              }
            }
          ]
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.output!.videos![0]).toEqual({
        video_id: 'video123',
        title: 'Test Video',
        description: '',
        channel_title: '',
        channel_id: '',
        published_at: '',
        thumbnails: { default: { url: '', width: 0, height: 0 } }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service unavailable (ECONNREFUSED)', async () => {
      const error = new Error('Connection refused');
      (error as Error & { code: string }).code = 'ECONNREFUSED';
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('YouTube API service is not available');
    });

    it('should handle service unavailable (ENOTFOUND)', async () => {
      const error = new Error('Host not found');
      (error as Error & { code: string }).code = 'ENOTFOUND';
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('YouTube API service is not available');
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Timeout');
      (error as Error & { code: string }).code = 'ETIMEDOUT';
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('YouTube search timed out');
    });

    it('should handle quota exceeded (403)', async () => {
      const error = {
        response: { status: 403, data: { error: { message: 'Quota exceeded' } } }
      };
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('YouTube API quota exceeded or access denied');
    });

    it('should handle invalid request (400)', async () => {
      const error = {
        response: { status: 400, data: { error: { message: 'Invalid request' } } }
      };
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Invalid YouTube API request parameters');
    });

    it('should handle generic API errors', async () => {
      const error = {
        response: { status: 500, data: { error: { message: 'Internal server error' } } }
      };
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('YouTube search failed: Internal server error');
    });

    it('should handle network errors without response', async () => {
      const error = new Error('Network error');
      mockedAxios.get.mockRejectedValueOnce(error);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('YouTube search failed: Network error');
    });

    it('should handle malformed API responses', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 200, data: null }
      });

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('YouTube search failed: Unknown error');
    });

    it('should handle API responses with non-200 status', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 400, data: { error: 'Some error' } }
      });

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Invalid YouTube API request parameters');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large result sets', async () => {
      const mockResponse = {
        data: {
          pageInfo: { totalResults: 1000000, resultsPerPage: 50 },
          items: Array(50).fill(null).map((_, i) => ({
            id: { videoId: `video${i}` },
            snippet: {
              title: `Video ${i}`,
              description: `Description ${i}`,
              channelTitle: `Channel ${i}`,
              channelId: `channel${i}`,
              publishedAt: '2023-01-01T00:00:00Z',
              thumbnails: { default: { url: `thumb${i}.jpg`, width: 120, height: 90 } }
            }
          }))
        },
        status: 200
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const call = {
        name: 'youtube-retriever',
        args: { query: 'popular search', max_results: 50 }
      };

      const result = await retriever.execute(call);

      expect(result.output!.videos).toHaveLength(50);
      expect(result.output!.total_results).toBe(1000000);
    });

    it('should handle special characters in query', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test & special "characters" <tags>' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'test & special "characters" <tags>'
          })
        })
      );
    });

    it('should handle unicode characters in query', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: 'тест búsqueda 検索' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'тест búsqueda 検索'
          })
        })
      );
    });

    it('should handle missing API key', async () => {
      delete process.env.YOUTUBE_API_KEY;

      mockedAxios.get.mockRejectedValueOnce(new Error('Service unavailable'));

      const call = {
        name: 'youtube-retriever',
        args: { query: 'test search' }
      };

      const result = await retriever.execute(call);
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('YouTube search failed: Service unavailable');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            key: ''
          })
        })
      );
    });
  });

  describe('Schema Validation', () => {
    it('should have valid input schema', () => {
      expect(retriever.metadata.inputSchema).toBeDefined();
      expect(typeof retriever.metadata.inputSchema).toBe('object');
    });

    it('should have valid output schema', () => {
      expect(retriever.metadata.outputSchema).toBeDefined();
      expect(typeof retriever.metadata.outputSchema).toBe('object');
    });
  });
});
