import { logger } from './logger';

export interface AudioStreamerCallbacks {
  onAudioChunk: (base64Pcm: string) => void;
  onVolumeChange: (volume: number) => void;
  onSpeechDetected?: () => void;
  onError: (error: Error) => void;
}

export class AudioStreamer {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isStreaming = false;
  private callbacks: AudioStreamerCallbacks;
  private speechEnergyThreshold = 0.05;
  private isUserSpeaking = false;

  constructor(callbacks: AudioStreamerCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    if (this.isStreaming) return;

    logger.log('MIC', 'Microphone permission requested');

    try {
      // Request mic with echoCancellation, noiseSuppression and autoGainControl
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;
      logger.log('MIC', 'Microphone permission granted');

      // Initialize input AudioContext
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const inputSampleRate = this.audioContext.sampleRate;
      logger.log('MIC', 'Microphone started', {
        inputSampleRate,
        targetSampleRate: 16000,
        channels: 1,
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // ScriptProcessor with bufferSize = 2048 (approx 43-46ms chunks)
      const bufferSize = 2048;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isStreaming) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);

        // 1. Calculate RMS volume for visualizer
        let sumSquares = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          sumSquares += inputChannelData[i] * inputChannelData[i];
        }
        const rms = Math.sqrt(sumSquares / inputChannelData.length);
        const normalizedVol = Math.min(1, rms * 5); // scaled for responsive UI
        this.callbacks.onVolumeChange(normalizedVol);

        // Interruption detection trigger
        if (rms > this.speechEnergyThreshold) {
          if (!this.isUserSpeaking) {
            this.isUserSpeaking = true;
            this.callbacks.onSpeechDetected?.();
          }
        } else {
          this.isUserSpeaking = false;
        }

        // 2. Downsample Float32 from inputSampleRate down to 16000 Hz PCM
        const downsampled = this.downsampleTo16k(
          inputChannelData,
          inputSampleRate,
          16000
        );

        // 3. Convert Float32 to 16-bit signed PCM
        const pcm16 = this.floatTo16BitPCM(downsampled);

        // 4. Convert Int16Array to Base64
        const base64 = this.pcmToBase64(pcm16);

        this.callbacks.onAudioChunk(base64);
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isStreaming = true;
    } catch (err: any) {
      logger.log('ERROR', 'Microphone capture error', { error: err?.message || err });
      this.callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      this.stop();
      throw err;
    }
  }

  public stop(): void {
    if (!this.isStreaming && !this.mediaStream) return;

    logger.log('MIC', 'Microphone stopped');
    this.isStreaming = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }

    this.callbacks.onVolumeChange(0);
  }

  public isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Resamples an array of Float32 samples to target sample rate (16000 Hz)
   */
  private downsampleTo16k(
    buffer: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) {
      return buffer;
    }
    const sampleRateRatio = fromRate / toRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }

  /**
   * Converts Float32Array (-1.0 to +1.0) to Int16Array (-32768 to 32767)
   */
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  /**
   * Encodes Int16Array to Base64 string
   */
  private pcmToBase64(pcm: Int16Array): string {
    let binary = '';
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
