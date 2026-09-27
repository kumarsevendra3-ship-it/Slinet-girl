import { logger } from './logger';

export interface AudioPlaybackCallbacks {
  onPlaybackStart: () => void;
  onPlaybackEnd: () => void;
  onVolumeChange: (volume: number) => void;
}

export class AudioPlaybackQueue {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private nextPlayTime = 0;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private callbacks: AudioPlaybackCallbacks;
  private isPlaying = false;
  private animFrameId: number | null = null;
  private pendingChunksCount = 0;

  constructor(callbacks: AudioPlaybackCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initializes or resumes the persistent AudioContext.
   * MUST be called during a genuine user interaction (click/touch).
   */
  public async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Initialize with sampleRate 24000 or default hardware rate
      this.audioContext = new AudioCtx();
      logger.log('AUDIO_OUT', 'AudioContext created', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
      });

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      logger.log('AUDIO_OUT', 'Audio output graph connected: GainNode -> AnalyserNode -> Destination');
    }

    if (this.audioContext.state === 'suspended') {
      logger.log('AUDIO_OUT', 'AudioContext state is suspended, resuming...');
      await this.audioContext.resume();
      logger.log('AUDIO_OUT', 'AudioContext resumed successfully', {
        state: this.audioContext.state,
      });
    }

    return this.audioContext;
  }

  public getAudioContextState(): string {
    return this.audioContext?.state || 'not_created';
  }

  /**
   * Diagnostic Speaker Test: Generates a 440Hz tone for 0.4s
   * through the exact same output graph to verify device speaker.
   */
  public async testSpeaker(): Promise<boolean> {
    try {
      const ctx = await this.initAudioContext();
      logger.log('AUDIO_OUT', 'Speaker diagnostic test initiated (440Hz tone)');

      const osc = ctx.createOscillator();
      const testGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Standard A4

      // Gentle attack and decay to avoid clicks
      testGain.gain.setValueAtTime(0.001, ctx.currentTime);
      testGain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      testGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(testGain);
      testGain.connect(this.gainNode || ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      logger.log('AUDIO_OUT', 'Speaker diagnostic 440Hz tone played through output graph');
      return true;
    } catch (err: any) {
      logger.log('ERROR', 'Speaker diagnostic test failed', { error: err?.message || err });
      return false;
    }
  }

  /**
   * Enqueues a base64-encoded PCM chunk received from Gemini Live.
   * Format: signed 16-bit PCM, little-endian, default 24000Hz.
   */
  public async enqueuePcmChunk(
    base64Pcm: string,
    sampleRate = 24000
  ): Promise<void> {
    try {
      const ctx = await this.initAudioContext();

      logger.log('AUDIO_OUT', 'Base64 decoding started', {
        dataLength: base64Pcm.length,
        sampleRate,
      });

      // 1. Decode base64 to binary string
      const binaryString = window.atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      logger.log('AUDIO_OUT', 'Base64 decoding successful', { byteLength: len });

      // 2. Decode 16-bit PCM Little-Endian safely using DataView
      logger.log('AUDIO_OUT', 'PCM decoding started');
      const sampleCount = Math.floor(len / 2);
      if (sampleCount === 0) return;

      const dataView = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
      const float32Array = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        // Linear 16-bit PCM signed, Little-Endian
        const int16Val = dataView.getInt16(i * 2, true);
        float32Array[i] = int16Val / 32768.0;
      }
      logger.log('AUDIO_OUT', 'PCM decoding successful');
      logger.log('AUDIO_OUT', 'Int16 conversion successful', { sampleCount });
      logger.log('AUDIO_OUT', 'Float32 conversion successful', { normalizedRange: '[-1.0, 1.0]' });

      // 3. Create AudioBuffer (single channel mono)
      const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const duration = audioBuffer.duration;
      logger.log('AUDIO_OUT', 'AudioBuffer created', {
        samples: sampleCount,
        duration: duration.toFixed(3) + 's',
        sampleRate,
      });

      // 4. Create AudioBufferSourceNode
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      logger.log('AUDIO_OUT', 'AudioBufferSourceNode created');

      source.connect(this.gainNode || ctx.destination);
      logger.log('AUDIO_OUT', 'Audio connected to destination');

      // 5. Schedule continuous sequential playback without gaps or overlaps
      const now = ctx.currentTime;
      const scheduledTime = Math.max(now, this.nextPlayTime);
      source.start(scheduledTime);
      logger.log('AUDIO_OUT', 'AudioBufferSourceNode started', {
        scheduledTime: scheduledTime.toFixed(3),
        currentTime: now.toFixed(3),
      });

      this.nextPlayTime = scheduledTime + duration;
      this.activeSourceNodes.push(source);
      this.pendingChunksCount++;

      if (!this.isPlaying) {
        this.isPlaying = true;
        this.callbacks.onPlaybackStart();
        this.startVolumeMonitoring();
        logger.log('AUDIO_OUT', 'Audio playback started', {
          firstChunkDuration: duration.toFixed(3) + 's',
        });
      }

      source.onended = () => {
        const idx = this.activeSourceNodes.indexOf(source);
        if (idx !== -1) {
          this.activeSourceNodes.splice(idx, 1);
        }
        this.pendingChunksCount--;

        if (this.pendingChunksCount <= 0 && this.activeSourceNodes.length === 0) {
          this.isPlaying = false;
          this.nextPlayTime = 0;
          this.stopVolumeMonitoring();
          this.callbacks.onPlaybackEnd();
          logger.log('AUDIO_OUT', 'Audio playback ended (queue empty)');
        }
      };
    } catch (err: any) {
      logger.log('ERROR', 'Audio playback error', {
        error: err?.message || err,
      });
      console.error('[AudioPlaybackQueue] Error:', err);
    }
  }

  /**
   * Immediate interruption: Stops all currently playing chunks and clears queue
   */
  public stopAll(): void {
    logger.log('AUDIO_OUT', 'Audio playback interrupted and queue cleared', {
      stoppedNodes: this.activeSourceNodes.length,
    });

    for (const source of this.activeSourceNodes) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    this.activeSourceNodes = [];
    this.pendingChunksCount = 0;
    this.nextPlayTime = 0;

    if (this.isPlaying) {
      this.isPlaying = false;
      this.stopVolumeMonitoring();
      this.callbacks.onPlaybackEnd();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private startVolumeMonitoring(): void {
    if (this.animFrameId) return;

    const dataArray = new Uint8Array(this.analyserNode?.frequencyBinCount || 128);

    const update = () => {
      if (!this.isPlaying) {
        this.callbacks.onVolumeChange(0);
        return;
      }

      if (this.analyserNode) {
        this.analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 128);
        this.callbacks.onVolumeChange(normalized);
      }

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  private stopVolumeMonitoring(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.callbacks.onVolumeChange(0);
  }
}
