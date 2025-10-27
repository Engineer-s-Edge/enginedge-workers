/**
 * Terminal Actor - Infrastructure Layer
 *
 * Provides safe command execution for agents with whitelisting and timeout protection.
 * Implements security measures to prevent dangerous command execution.
 */

import { spawn } from 'child_process';
import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import { ActorConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type TerminalOperation = 'execute';

export interface TerminalArgs {
  operation: TerminalOperation;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: boolean;
}

export interface TerminalOutput extends ToolOutput {
  success: boolean;
  operation: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

interface CommandError extends Error {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

@Injectable()
export class TerminalActor extends BaseActor<TerminalArgs, TerminalOutput> {
  readonly name = 'terminal-actor';
  readonly description = 'Safely execute terminal commands with timeout and security restrictions';

  errorEvents: ErrorEvent[];
  metadata: ActorConfig;

  constructor() {
    const errorEvents = [
      new ErrorEvent('CommandExecutionError', 'Check command syntax and ensure executable exists', false),
      new ErrorEvent('SecurityError', 'Command blocked for security reasons - use allowed commands only', false),
      new ErrorEvent('TimeoutError', 'Command took too long - consider increasing timeout or using faster alternative', true),
    ];

    const metadata = new ActorConfig(
      'terminal-actor',
      'Safely execute terminal commands with timeout and security restrictions',
      'Execute safe terminal commands for automation within controlled environment',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation', 'command'],
        properties: {
          operation: {
            type: 'string',
            enum: ['execute'],
            description: 'The operation to perform'
          },
          command: {
            type: 'string',
            description: 'The command to execute'
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments'
          },
          cwd: {
            type: 'string',
            description: 'Working directory for command execution'
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Environment variables'
          },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 300000, // 5 minutes max
            default: 30000,
            description: 'Command timeout in milliseconds'
          },
          shell: {
            type: 'boolean',
            default: false,
            description: 'Whether to execute through shell'
          }
        }
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          command: { type: 'string' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          exitCode: { type: 'number' },
          duration: { type: 'number' }
        }
      },
      [
        {
          operation: 'execute',
          command: 'echo',
          args: ['Hello World']
        }
      ],
      ActorCategory.INTERNAL_SANDBOX,
      false
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }  get category(): ActorCategory {
    return ActorCategory.INTERNAL_SANDBOX;
  }

  get requiresAuth(): boolean {
    return false;
  }

  protected async act(args: TerminalArgs): Promise<TerminalOutput> {
    const startTime = Date.now();

    // Validate command safety
    this.validateCommand(args.command, args.args || []);

    try {
      const result = await this.executeCommand(args);
      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        operation: 'execute',
        command: args.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as CommandError;
      throw Object.assign(new Error(`Command execution failed: ${err.message}`), {
        name: 'CommandExecutionError',
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.exitCode || -1,
        duration
      });
    }
  }

  private validateCommand(command: string, args: string[]): void {
    // Dangerous commands that should be blocked
    const dangerousCommands = [
      'rm', 'del', 'format', 'fdisk', 'mkfs',
      'sudo', 'su', 'chmod', 'chown',
      'passwd', 'usermod', 'userdel',
      'systemctl', 'service', 'init',
      'shutdown', 'reboot', 'halt',
      'dd', 'mkfs', 'fsck',
      'wget', 'curl', // Block direct downloads
      'ssh', 'scp', 'ftp', // Block network access
      'nc', 'netcat', 'telnet', // Block network tools
      'python', 'node', 'bash', 'sh', 'zsh', 'fish' // Block interpreters
    ];

    const fullCommand = [command, ...args].join(' ').toLowerCase();

    for (const dangerous of dangerousCommands) {
      if (fullCommand.includes(dangerous)) {
        throw Object.assign(new Error(`Command contains blocked operation: ${dangerous}`), {
          name: 'SecurityError'
        });
      }
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /\brm\s+-rf\s+\/+/,
      /\bdd\s+if=/,
      /\b>\s*\/dev\//,
      /sudo\s+/,
      /chmod\s+777/,
      /curl\s+.*\|\s*bash/,
      /wget\s+.*\|\s*bash/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        throw Object.assign(new Error('Command contains dangerous pattern'), {
          name: 'SecurityError'
        });
      }
    }
  }

  private async executeCommand(args: TerminalArgs): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const timeout = args.timeout || 30000;
      const cwd = args.cwd || process.cwd();
      const env = { ...process.env, ...args.env };

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(args.command, args.args || [], {
        cwd,
        env,
        shell: args.shell || false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');

        // Force kill after grace period
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(Object.assign(new Error('Command timed out'), {
            name: 'TimeoutError',
            stdout,
            stderr,
            exitCode: -1
          }));
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code || 0
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(Object.assign(new Error(`Command execution error: ${error.message}`), {
          name: 'ExecutionError',
          stdout,
          stderr,
          exitCode: -1
        }));
      });
    });
  }
}