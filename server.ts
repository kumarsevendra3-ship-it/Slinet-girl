import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const server = http.createServer(app);

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Create WebSocket server attached to the HTTP server on /ws/live
const wss = new WebSocketServer({ server, path: '/ws/live' });

const ARUSHI_SYSTEM_INSTRUCTION = `You are Arushi, a young, confident, witty, playful, and emotionally responsive virtual assistant. Talk naturally and casually like a close friend. Be expressive, slightly teasing, funny, and smart when appropriate. Use light sarcasm and witty responses. Never sound robotic. Adapt your tone to the user's emotions and conversation.

AUTOMATIC MULTI-LANGUAGE RULE:
Automatically understand and respond in the language the user is speaking.
If user speaks Hindi: respond naturally in Hindi.
If user speaks English: respond naturally in English.
If user speaks Hinglish: respond naturally in Hinglish.
If user speaks Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, or Urdu: respond fluently and naturally in that language.
If user switches languages or mixes languages: switch effortlessly without being asked.
Never translate everything mechanically. Respond directly and naturally.

CONVERSATION STYLE:
Keep spoken responses concise, punchy, and natural for real-time voice conversation. Avoid long walls of text or monologues.

DEVICE ACTION TOOLS:
You can execute safe supported device actions through available tools:
1. openWhatsApp: opens WhatsApp on the device.
2. openApp: opens supported applications (e.g. YouTube, Instagram, Spotify, Maps, Camera, Calculator, Chrome).
3. openUrl: opens a validated web URL.
4. makeCall: dials a phone number.
5. callContact: finds a contact by name (e.g. Mom, Mummy, Dad, Rahul) and initiates calling.
Never claim that an action was completed unless the application actually executed it and returned success.
Avoid explicit or inappropriate content while maintaining your charm, confidence, and personality.`;

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'openWhatsApp',
    description: 'Opens WhatsApp messaging app on the user device.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: 'Optional message to pre-fill in WhatsApp',
        },
        phoneNumber: {
          type: Type.STRING,
          description: 'Optional phone number with country code to open chat with',
        },
      },
    },
  },
  {
    name: 'openApp',
    description: 'Opens a supported installed application by name, such as YouTube, Instagram, Spotify, Maps, Camera, Calculator, Chrome, Gmail.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appName: {
          type: Type.STRING,
          description: 'Name of the application to open (e.g. YouTube, Instagram, Spotify, Maps, Camera, Calculator, Chrome)',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'openUrl',
    description: 'Opens a validated HTTP/HTTPS website URL in the browser.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The full URL to open (must start with https:// or http://)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'makeCall',
    description: 'Initiates a phone call or opens the device dialer with a specific phone number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneNumber: {
          type: Type.STRING,
          description: 'The phone number to dial, including country code if available',
        },
      },
      required: ['phoneNumber'],
    },
  },
  {
    name: 'callContact',
    description: 'Searches contacts by name (e.g., Mom, Mummy, Dad, Rahul, Priya) and initiates calling.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactName: {
          type: Type.STRING,
          description: 'The name of the contact to call',
        },
      },
      required: ['contactName'],
    },
  },
];

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Server] Client connected to /ws/live WebSocket');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Server] GEMINI_API_KEY is not set in environment!');
    clientWs.send(
      JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server.',
      })
    );
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let liveSession: any = null;
  let isClosed = false;
  const messageQueue: any[] = [];

  // Function to establish Gemini Live connection
  async function connectLive(modelName: string) {
    console.log(`[Server] Connecting to Gemini Live with model: ${modelName}...`);
    try {
      const session = await ai.live.connect({
        model: modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore', // Warm, expressive female voice matching Arushi
              },
            },
          },
          systemInstruction: ARUSHI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => {
            console.log(`[Server] Gemini Live WebSocket opened for model ${modelName}!`);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Check for audio chunks and text in modelTurn
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                // Audio data
                if (part.inlineData?.data) {
                  const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';
                  clientWs.send(
                    JSON.stringify({
                      type: 'audio',
                      pcm: part.inlineData.data,
                      mimeType,
                    })
                  );
                }
                // Text transcription if provided by the model
                if (part.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'text',
                      text: part.text,
                    })
                  );
                }
              }
            }

            // 2. Turn completion
            if (msg.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turnComplete' }));
            }

            // 3. User interruption signal from Gemini
            if (msg.serverContent?.interrupted) {
              console.log('[Server] Gemini signaled user interruption!');
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // 4. Tool/function calls
            if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
              console.log('[Server] Gemini tool call requested:', JSON.stringify(msg.toolCall.functionCalls));
              clientWs.send(
                JSON.stringify({
                  type: 'toolCall',
                  functionCalls: msg.toolCall.functionCalls,
                })
              );
            }
          },
          onerror: (err: any) => {
            console.error(`[Server] Gemini Live error on ${modelName}:`, err?.message || err);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: `Gemini Live error: ${err?.message || 'Connection issue'}`,
                })
              );
            }
          },
          onclose: (e: any) => {
            console.log(`[Server] Gemini Live session closed: code=${e?.code}, reason=${e?.reason}`);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'sessionClosed',
                  code: e?.code,
                  reason: e?.reason,
                })
              );
            }
          },
        },
      });

      liveSession = session;
      console.log(`[Server] Live session assigned and ready for model: ${modelName}`);

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'connected',
            model: modelName,
            voice: 'Kore',
          })
        );
      }

      // Flush any queued messages received while connecting
      while (messageQueue.length > 0) {
        const queued = messageQueue.shift();
        handleClientMessage(queued);
      }

      return session;
    } catch (err: any) {
      console.error(`[Server] Failed to connect with ${modelName}:`, err?.message || err);
      throw err;
    }
  }

  function handleClientMessage(msg: any) {
    if (!liveSession) return;
    try {
      if (msg.type === 'audio' && msg.pcm) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.pcm,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (msg.type === 'text' && msg.text) {
        console.log('[Server] Sending realtime text input to Gemini:', msg.text);
        liveSession.sendRealtimeInput({
          text: msg.text,
        });
      } else if (msg.type === 'toolResponse' && msg.functionResponses) {
        console.log('[Server] Sending tool responses to Gemini:', JSON.stringify(msg.functionResponses));
        liveSession.sendToolResponse({
          functionResponses: msg.functionResponses,
        });
      } else if (msg.type === 'interrupted') {
        console.log('[Server] Client signaled interruption');
      }
    } catch (err: any) {
      console.error('[Server] Error dispatching message to Gemini Live:', err?.message || err);
    }
  }

  try {
    // Try preferred model 'gemini-3.1-flash-live-preview', fallback to 'gemini-3.8-live'
    try {
      liveSession = await connectLive('gemini-3.1-flash-live-preview');
    } catch (primaryErr) {
      console.warn('[Server] Primary model failed, falling back to gemini-3.8-live...', primaryErr);
      liveSession = await connectLive('gemini-3.8-live');
    }
  } catch (finalErr: any) {
    console.error('[Server] All Gemini Live connections failed:', finalErr?.message || finalErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: `Unable to connect to Gemini Live: ${finalErr?.message || 'Unknown error'}`,
        })
      );
      clientWs.close();
    }
    return;
  }

  // Handle messages from client
  clientWs.on('message', (raw: Buffer) => {
    if (isClosed) return;

    try {
      const msg = JSON.parse(raw.toString());
      if (!liveSession) {
        messageQueue.push(msg);
      } else {
        handleClientMessage(msg);
      }
    } catch (err: any) {
      console.error('[Server] Error handling client message:', err?.message || err);
    }
  });

  clientWs.on('close', () => {
    console.log('[Server] Client disconnected from /ws/live');
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
  });

  clientWs.on('error', (err) => {
    console.error('[Server] Client WebSocket error:', err);
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
  });
});

// Setup Vite middleware in development or serve static dist in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Mounted Vite development middleware');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Serving production static build from dist');
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Arushi Voice Assistant running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
