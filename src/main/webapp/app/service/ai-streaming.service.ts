import { Injectable, inject } from '@angular/core';
import { KeycloakAuthenticationService } from 'app/core/auth/keycloak-authentication.service';
import { JobFormDTO } from 'app/generated/model/job-form-dto';

import { AiFeatureStatusService } from './ai-feature-status.service';

/**
 * Service for streaming AI responses using Server-Sent Events (SSE).
 *
 * Angular's {@link HttpClient} does not support true byte-level streaming,
 * so this service uses the native Fetch API with a {@link ReadableStream} reader
 * to process SSE chunks as they arrive from the backend.
 *
 * Each SSE line has the format `data:<content>\n`. Content chunks are accumulated
 * and forwarded to a caller-provided callback for real-time UI updates.
 */
@Injectable({
  providedIn: 'root',
})
export class AiStreamingService {
  private keycloakService = inject(KeycloakAuthenticationService);
  private aiFeatureStatus = inject(AiFeatureStatusService);

  /**
   * Generates a job application draft using streaming SSE.
   *
   * Sends the job form data to the AI generation endpoint and streams back
   * the generated content chunk by chunk, calling the provided callback
   * for each chunk to enable real-time editor updates.
   *
   * @param lang The language for the generated job description ('en' or 'de')
   * @param jobFormDTO The job form data used to build the AI prompt
   * @param onChunk Callback invoked with the accumulated content after each SSE chunk
   * @returns Promise resolving to the full accumulated content on stream completion
   * @throws Error on HTTP errors or network failures
   */
  async generateJobApplicationDraftStream(
    lang: string,
    jobFormDTO: JobFormDTO,
    onChunk: (accumulatedContent: string) => void,
  ): Promise<string> {
    const url = `/api/ai/generateJobApplicationDraftStream?lang=${encodeURIComponent(lang)}`;
    return this.streamSSE(url, JSON.stringify(jobFormDTO), onChunk);
  }

  /**
   * Translates a job description using streaming SSE.
   *
   * Sends the source text to the AI translation endpoint and streams back
   * the translated content. Supports cancellation via {@link AbortSignal},
   * allowing the caller to abort an in-progress translation (e.g. when
   * the user edits the source text and a new translation cycle starts).
   *
   * @param toLang The target language ('en' or 'de')
   * @param text The HTML job description text to translate
   * @param onChunk Callback invoked with the accumulated content after each SSE chunk
   * @param signal Optional {@link AbortSignal} for cancellation; when aborted, the
   *               stream reader is cancelled and the promise rejects with an AbortError
   * @returns Promise resolving to the full accumulated content on stream completion
   * @throws DOMException with name 'AbortError' if the signal is aborted
   * @throws Error on HTTP errors or network failures
   */
  async translateJobDescriptionStream(
    toLang: string,
    text: string,
    onChunk: (accumulatedContent: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `/api/ai/translateJobDescriptionStream?toLang=${encodeURIComponent(toLang)}`;
    return this.streamSSE(url, JSON.stringify({ text }), onChunk, signal);
  }

  /**
   * Core SSE streaming method shared by all AI streaming endpoints.
   *
   * Opens a streaming connection via the Fetch API and processes the response
   * as Server-Sent Events, accumulating content and forwarding it to the callback.
   *
   * The processing follows these steps:
   *
   * 1) Build authenticated request headers (Bearer token from Keycloak)
   * 2) Open the SSE connection via fetch() with the given body and optional AbortSignal
   * 3) Read the response stream chunk by chunk using a ReadableStream reader
   * 4) Buffer incomplete lines across chunk boundaries (SSE lines end with \n)
   * 5) For each complete `data:` line, strip the prefix, append to accumulated content,
   *    and invoke the onChunk callback with the full accumulated content so far
   * 6) After the stream ends, process any remaining buffered content
   * 7) Return the final accumulated content
   *
   * @param url The full API URL including query parameters
   * @param body The JSON-serialized request body
   * @param onChunk Callback invoked with accumulated content after each SSE data line
   * @param signal Optional AbortSignal for cancellation support
   * @returns Promise resolving to the full accumulated content
   */
  private async streamSSE(url: string, body: string, onChunk: (accumulatedContent: string) => void, signal?: AbortSignal): Promise<string> {
    // 1) Build authenticated request headers
    const token = this.keycloakService.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if ((token ?? '') !== '') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 2) Open the SSE connection via fetch
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
      credentials: 'include',
      signal,
    });

    if (!response.ok) {
      if (response.status === 503) {
        this.aiFeatureStatus.markUnavailable();
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 3) Obtain a ReadableStream reader for byte-level streaming
    const reader = response.body?.getReader();
    if (!reader) {
      return '';
    }

    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let lineBuffer = ''; // 4) Buffer for incomplete lines across chunk boundaries
    let done = false;

    try {
      while (!done) {
        const result = await reader.read();
        done = result.done;

        if (result.value) {
          // Decode the raw bytes and prepend any leftover from the previous chunk
          const chunk = lineBuffer + decoder.decode(result.value, { stream: true });

          // Split by newlines; the last element may be incomplete
          const lines = chunk.split('\n');
          lineBuffer = lines.pop() ?? '';

          // 5) Process all complete SSE data lines
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const content = line.slice(5); // Strip "data:" prefix
              accumulatedContent += content;
              onChunk(accumulatedContent);
            }
            // Ignore empty lines and other SSE fields (event:, id:, retry:)
          }
        }
      }

      // 6) Process any remaining buffered content after stream ends
      if (lineBuffer.startsWith('data:')) {
        const content = lineBuffer.slice(5);
        accumulatedContent += content;
        onChunk(accumulatedContent);
      }
    } catch (e) {
      // On abort or error, cancel the reader to release the connection
      void reader.cancel();
      throw e;
    }

    // 7) Return the full accumulated content
    return accumulatedContent;
  }
}
