import { DiagnosticLog } from '../types/assistant';

type LogListener = (logs: DiagnosticLog[]) => void;

export type LogCategory = 'LIVE' | 'MIC' | 'AUDIO_OUT' | 'TOOL' | 'ERROR' | 'live' | 'mic' | 'audio' | 'device' | 'error';

class PipelineLogger {
  private logs: DiagnosticLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 250;

  public log(
    category: LogCategory,
    message: string,
    data?: any
  ): void {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const normalizedCategory: DiagnosticLog['category'] =
      category.toUpperCase() === 'AUDIO' ? 'AUDIO_OUT' :
      category.toUpperCase() === 'DEVICE' ? 'TOOL' :
      (category.toUpperCase() as DiagnosticLog['category']);

    const entry: DiagnosticLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp,
      category: normalizedCategory,
      message,
      data,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Console logging with distinct styling
    const colorMap: Record<string, string> = {
      LIVE: '#8b5cf6',
      MIC: '#06b6d4',
      AUDIO_OUT: '#10b981',
      TOOL: '#f59e0b',
      ERROR: '#ef4444',
    };

    const color = colorMap[normalizedCategory] || '#8b5cf6';

    console.log(
      `%c[${normalizedCategory}] ${timestamp} %c${message}`,
      `color: ${color}; font-weight: bold;`,
      'color: inherit;',
      data !== undefined ? data : ''
    );

    this.notify();
  }

  public getLogs(): DiagnosticLog[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getLogs();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Logger listener error:', err);
      }
    });
  }
}

export const logger = new PipelineLogger();
