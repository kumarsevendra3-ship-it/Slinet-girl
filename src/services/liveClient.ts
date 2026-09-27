import { AssistantState, ToolCallPayload, ToolResult, ActionLogItem } from '../types/assistant';
import { AudioStreamer } from './audioStreamer';
import { AudioPlaybackQueue } from './audioPlaybackQueue';
import { deviceActionBridge } from './deviceActionBridge';
import { logger } from './logger';

export interface LiveClientCallbacks {
  onStateChange: (state: AssistantState) => void;
  onMicVolumeChange: (volume: number) => void;
  onVoiceVolumeChange: (volume: number) => void;
  onActionTriggered: (actionItem: ActionLogItem) => void;
  onError: (message: string) => void;
  onTranscript?: (text: string, isUser: boolean) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer;
  private playbackQueue: AudioPlaybackQueue;
  private state: AssistantState = 'IDLE';
  private callbacks: LiveClientCallbacks;
  private isUserIntendedDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;

    this.playbackQueue = new AudioPlaybackQueue({
      onPlaybackStart: () => {
        if (this.state !== 'PROCESSING') {
          this.setState('SPEAKING');
        }
      },
      onPlaybackEnd: () => {
        if (this.state === 'SPEAKING') {
          this.setState('LISTENING');
        }
      },
      onVolumeChange: (vol) => {
        this.callbacks.onVoiceVolumeChange(vol);
      },
    });

    this.streamer = new AudioStreamer({
      onAudioChunk: (base64Pcm) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              pcm: base64Pcm,
            })
          );
        }
      },
      onVolumeChange: (vol) => {
        this.callbacks.onMicVolumeChange(vol);
      },
      onSpeechDetected: () => {
        // Interruption: If user starts speaking while Arushi is speaking
        if (this.state === 'SPEAKING' || this.playbackQueue.getIsPlaying()) {
          logger.log('LIVE', 'User interrupted Arushi speaking locally');
          this.handleInterruption();
        }
      },
      onError: (err) => {
        this.handleError(`Microphone error: ${err.message}`);
      },
    });
  }

  public async connect(): Promise<void> {
    if (this.state === 'CONNECTING' || this.state === 'LISTENING') return;

    this.isUserIntendedDisconnect = false;
    this.setState('CONNECTING');
    logger.log('LIVE', 'Gemini session connecting...');

    try {
      // 1. Initialize persistent AudioContext on this genuine user click
      await this.playbackQueue.initAudioContext();

      // 2. Open WebSocket connection to /ws/live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      logger.log('LIVE', `Opening WebSocket to ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        logger.log('LIVE', 'WebSocket connection opened to server');
        // Once socket is open, start microphone streaming
        try {
          await this.streamer.start();
          this.setState('LISTENING');
          this.reconnectAttempts = 0;
          logger.log('LIVE', 'Gemini session connected, microphone active and listening');
        } catch (micErr: any) {
          this.handleError(`Microphone access failed: ${micErr?.message || micErr}`);
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle audio from Gemini Live
          if (msg.type === 'audio' && msg.pcm) {
            logger.log('LIVE', 'Gemini response received (audio chunk)', {
              mimeType: msg.mimeType,
              length: msg.pcm.length,
            });
            await this.playbackQueue.enqueuePcmChunk(msg.pcm, 24000);
          }

          // Handle text / transcript from Gemini Live
          if (msg.type === 'text' && msg.text) {
            this.callbacks.onTranscript?.(msg.text, false);
          }

          // Handle turn completion
          if (msg.type === 'turnComplete') {
            logger.log('LIVE', 'Gemini response turnComplete received');
          }

          // Handle Gemini server interruption signal
          if (msg.type === 'interrupted') {
            logger.log('LIVE', 'Gemini server signaled user interruption');
            this.handleInterruption();
          }

          // Handle tool / function calls from Gemini Live
          if (msg.type === 'toolCall' && msg.functionCalls) {
            await this.handleToolCalls(msg.functionCalls);
          }

          // Handle error from server
          if (msg.type === 'error') {
            logger.log('ERROR', 'Server error message', msg.message);
            this.handleError(msg.message);
          }

          // Handle session closed from server
          if (msg.type === 'sessionClosed') {
            logger.log('LIVE', 'Server reported Gemini session closed', msg);
            if (!this.isUserIntendedDisconnect) {
              this.reconnect();
            }
          }
        } catch (parseErr: any) {
          logger.log('ERROR', 'Failed to parse server message', parseErr);
        }
      };

      this.ws.onerror = (err) => {
        logger.log('ERROR', 'WebSocket error', err);
      };

      this.ws.onclose = (event) => {
        logger.log('LIVE', `WebSocket closed (code: ${event.code})`);
        if (!this.isUserIntendedDisconnect) {
          this.reconnect();
        } else {
          this.setState('IDLE');
        }
      };
    } catch (err: any) {
      this.handleError(`Connection setup failed: ${err?.message || err}`);
    }
  }

  public disconnect(): void {
    logger.log('LIVE', 'User requested assistant disconnect');
    this.isUserIntendedDisconnect = true;
    this.streamer.stop();
    this.playbackQueue.stopAll();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.setState('IDLE');
  }

  public async testSpeaker(): Promise<boolean> {
    return await this.playbackQueue.testSpeaker();
  }

  public getState(): AssistantState {
    return this.state;
  }

  public sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks.onTranscript?.(text, true);
      this.ws.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    }
  }

  private handleInterruption(): void {
    this.playbackQueue.stopAll();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupted' }));
    }
    if (this.state === 'SPEAKING') {
      this.setState('LISTENING');
    }
  }

  private async handleToolCalls(functionCalls: ToolCallPayload[]): Promise<void> {
    this.setState('PROCESSING');
    logger.log('TOOL', 'Received tool calls from Gemini', functionCalls);

    const responses: any[] = [];

    for (const call of functionCalls) {
      let result: ToolResult;
      const callName = call.name;
      const callArgs = call.args || {};

      const actionItem: ActionLogItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toLocaleTimeString(),
        action: callName,
        description: `Executing ${callName}`,
        status: 'pending',
      };
      this.callbacks.onActionTriggered(actionItem);

      try {
        switch (callName) {
          case 'openWhatsApp':
            result = await deviceActionBridge.openWhatsApp(callArgs);
            actionItem.description = result.message || 'WhatsApp action completed';
            break;

          case 'openApp':
            result = await deviceActionBridge.openApp(callArgs.appName);
            actionItem.description = result.message || `Opened app: ${callArgs.appName}`;
            break;

          case 'openUrl':
            result = await deviceActionBridge.openUrl(callArgs.url);
            actionItem.description = result.message || `Opened URL: ${callArgs.url}`;
            break;

          case 'makeCall':
            result = await deviceActionBridge.makeCall(callArgs.phoneNumber);
            actionItem.description = result.message || `Dialing ${callArgs.phoneNumber}`;
            break;

          case 'callContact':
            result = await deviceActionBridge.callContact(callArgs.contactName);
            actionItem.description = result.message || `Calling contact: ${callArgs.contactName}`;
            break;

          default:
            result = {
              success: false,
              action: callName,
              error: `Unknown action: ${callName}`,
            };
            actionItem.description = `Unknown tool: ${callName}`;
        }
      } catch (err: any) {
        result = {
          success: false,
          action: callName,
          error: `Execution error: ${err?.message || err}`,
        };
        actionItem.description = `Action failed: ${err?.message || err}`;
      }

      actionItem.status = result.success ? 'success' : 'failure';
      actionItem.details = result;
      this.callbacks.onActionTriggered(actionItem);

      responses.push({
        id: call.id,
        name: call.name,
        response: {
          output: result,
        },
      });
    }

    // Send tool responses back to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.log('TOOL', 'Returning tool execution responses to Gemini', responses);
      this.ws.send(
        JSON.stringify({
          type: 'toolResponse',
          functionResponses: responses,
        })
      );
    }

    // Return state to LISTENING or let playback handle SPEAKING
    if (!this.playbackQueue.getIsPlaying()) {
      this.setState('LISTENING');
    }
  }

  private handleError(message: string): void {
    logger.log('ERROR', message);
    this.setState('ERROR');
    this.callbacks.onError(message);
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError('Connection lost. Please tap the power button to reconnect.');
      return;
    }

    this.reconnectAttempts++;
    logger.log('LIVE', `Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.setState('CONNECTING');

    setTimeout(() => {
      if (!this.isUserIntendedDisconnect) {
        this.connect();
      }
    }, 1500);
  }

  private setState(newState: AssistantState): void {
    if (this.state !== newState) {
      logger.log('LIVE', `State changed: ${this.state} -> ${newState}`);
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }
}
