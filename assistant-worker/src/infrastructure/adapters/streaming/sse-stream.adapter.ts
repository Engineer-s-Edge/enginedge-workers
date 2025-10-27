/**
 * Server-Sent Events (SSE) Stream Adapter
 * 
 * Provides real-time streaming of agent execution updates to clients.
 * Supports progress updates, token streaming, and event notifications.
 */

import { Injectable } from '@nestjs/common';
import { Response } from 'express';

export interface StreamEvent {
  type: 'start' | 'progress' | 'token' | 'thought' | 'tool' | 'complete' | 'error';
  data: any;
  timestamp: Date;
}

/**
 * SSE Stream Adapter
 */
@Injectable()
export class SSEStreamAdapter {
  private activeStreams: Map<string, Response> = new Map();

  /**
   * Initialize SSE connection
   */
  initializeStream(streamId: string, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection event
    this.sendEvent(res, {
      type: 'start',
      data: { streamId, message: 'Stream connected' },
      timestamp: new Date(),
    });

    // Store active stream
    this.activeStreams.set(streamId, res);

    // Handle client disconnect
    res.on('close', () => {
      this.activeStreams.delete(streamId);
    });
  }

  /**
   * Send an event to the stream
   */
  sendEvent(res: Response, event: StreamEvent): void {
    const data = JSON.stringify({
      type: event.type,
      data: event.data,
      timestamp: event.timestamp.toISOString(),
    });

    res.write(`event: ${event.type}\n`);
    res.write(`data: ${data}\n\n`);
  }

  /**
   * Send event to a specific stream by ID
   */
  sendToStream(streamId: string, event: StreamEvent): boolean {
    const res = this.activeStreams.get(streamId);
    
    if (!res) {
      return false;
    }

    this.sendEvent(res, event);
    return true;
  }

  /**
   * Send progress update
   */
  sendProgress(streamId: string, progress: number, message: string): boolean {
    return this.sendToStream(streamId, {
      type: 'progress',
      data: { progress, message },
      timestamp: new Date(),
    });
  }

  /**
   * Send token (for LLM streaming)
   */
  sendToken(streamId: string, token: string): boolean {
    return this.sendToStream(streamId, {
      type: 'token',
      data: { token },
      timestamp: new Date(),
    });
  }

  /**
   * Send agent thought
   */
  sendThought(streamId: string, thought: string, step: number): boolean {
    return this.sendToStream(streamId, {
      type: 'thought',
      data: { thought, step },
      timestamp: new Date(),
    });
  }

  /**
   * Send tool execution update
   */
  sendToolExecution(streamId: string, toolName: string, args: any, result?: any): boolean {
    return this.sendToStream(streamId, {
      type: 'tool',
      data: { toolName, args, result },
      timestamp: new Date(),
    });
  }

  /**
   * Send completion event
   */
  sendComplete(streamId: string, result: any): boolean {
    const sent = this.sendToStream(streamId, {
      type: 'complete',
      data: result,
      timestamp: new Date(),
    });

    // Close stream after completion
    this.closeStream(streamId);

    return sent;
  }

  /**
   * Send error event
   */
  sendError(streamId: string, error: string | Error): boolean {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    const sent = this.sendToStream(streamId, {
      type: 'error',
      data: { error: errorMessage },
      timestamp: new Date(),
    });

    // Close stream after error
    this.closeStream(streamId);

    return sent;
  }

  /**
   * Close a stream
   */
  closeStream(streamId: string): void {
    const res = this.activeStreams.get(streamId);
    
    if (res) {
      res.end();
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Check if stream is active
   */
  isStreamActive(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Close all streams
   */
  closeAllStreams(): void {
    for (const [streamId, res] of this.activeStreams.entries()) {
      res.end();
    }
    this.activeStreams.clear();
  }
}

