import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { AiStreamingService } from 'app/service/ai-streaming.service';
import { KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';
import { ReadableStream as NodeReadableStream } from 'stream/web';

// Helper to create a mock ReadableStream from chunks
function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  // Use Node's ReadableStream for test environment, cast to avoid TS union issues
  const StreamConstructor = NodeReadableStream as unknown as typeof ReadableStream;

  return new StreamConstructor<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Helper to create a mock fetch response
function createMockResponse(chunks: string[], status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: createMockReadableStream(chunks),
  } as unknown as Response;
}

describe('AiStreamingService', () => {
  let service: AiStreamingService;
  let mockKeycloakService: { getToken: Mock };
  let fetchSpy: Mock;
  let signal: AbortSignal;

  beforeEach(() => {
    mockKeycloakService = {
      getToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      providers: [AiStreamingService, { provide: KeycloakAuthenticationService, useValue: mockKeycloakService }],
    });

    service = TestBed.inject(AiStreamingService);
    signal = new AbortController().signal;

    // Mock global fetch
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateJobApplicationDraftStream', () => {
    it('should parse complete SSE lines correctly', async () => {
      const chunks = ['data:{"jobDescription":"Hello"}\n\n'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      expect(result).toBe('{"jobDescription":"Hello"}');
      expect(onChunk).toHaveBeenCalledWith('{"jobDescription":"Hello"}');
    });

    it('should handle multiple SSE lines in one chunk', async () => {
      const chunks = ['data:part1\ndata:part2\n\n'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      expect(result).toBe('part1part2');
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'part1');
      expect(onChunk).toHaveBeenNthCalledWith(2, 'part1part2');
    });

    it('should buffer incomplete lines across chunk boundaries', async () => {
      // Simulate a line split across two chunks
      const chunks = [
        'data:{"jobDes', // First chunk ends mid-line
        'cription":"test"}\n\n', // Second chunk completes the line
      ];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      // The complete content should be assembled correctly
      expect(result).toBe('{"jobDescription":"test"}');
      expect(onChunk).toHaveBeenCalledWith('{"jobDescription":"test"}');
    });

    it('should handle data line split exactly after "data:" prefix', async () => {
      const chunks = [
        'data:', // Just the prefix
        '{"content":"value"}\n\n', // The actual content
      ];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      expect(result).toBe('{"content":"value"}');
    });

    it('should ignore empty lines and non-data SSE fields', async () => {
      const chunks = ['event:message\nid:123\ndata:content\nretry:5000\n\n'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      // Only data: line should be processed
      expect(result).toBe('content');
      expect(onChunk).toHaveBeenCalledOnce();
    });

    it('should process remaining buffer content after stream ends', async () => {
      // Stream ends without a trailing newline
      const chunks = ['data:final-content'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      expect(result).toBe('final-content');
    });

    it('should throw error on non-ok response', async () => {
      fetchSpy.mockResolvedValue(createMockResponse([], 401));

      await expect(service.generateJobApplicationDraftStream('en', {} as never, vi.fn(), signal)).rejects.toThrow(
        'HTTP error! status: 401',
      );
    });

    it('should return empty string when response body is null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
      });

      const result = await service.generateJobApplicationDraftStream('en', {} as never, vi.fn(), signal);

      expect(result).toBe('');
    });

    it('should include Authorization header when token exists', async () => {
      const chunks = ['data:test\n\n'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      await service.generateJobApplicationDraftStream('en', {} as never, vi.fn(), signal);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      );
    });

    it('should not include Authorization header when no token', async () => {
      mockKeycloakService.getToken.mockReturnValue(null);
      const chunks = ['data:test\n\n'];
      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      await service.generateJobApplicationDraftStream('en', {} as never, vi.fn(), signal);

      const callHeaders = fetchSpy.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBeUndefined();
    });

    it('should handle large responses split across many chunks', async () => {
      // Simulate a large response split into many small chunks
      const fullContent = '{"jobDescription":"' + 'x'.repeat(1000) + '"}';
      const chunkSize = 50;
      const chunks: string[] = [];

      // Split the data line into multiple chunks
      const dataLine = 'data:' + fullContent + '\n\n';
      for (let i = 0; i < dataLine.length; i += chunkSize) {
        chunks.push(dataLine.slice(i, i + chunkSize));
      }

      fetchSpy.mockResolvedValue(createMockResponse(chunks));

      const onChunk = vi.fn();
      const result = await service.generateJobApplicationDraftStream('en', {} as never, onChunk, signal);

      expect(result).toBe(fullContent);
    });
  });
});
