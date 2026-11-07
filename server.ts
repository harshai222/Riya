import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

app.use(express.json());

// API health and status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Tool declarations for Gemini Live session
const openWebsiteTool: FunctionDeclaration = {
  name: 'openWebsite',
  description: 'Opens a website, web app, or URL for the user in their browser (e.g., YouTube, Spotify, Google, GitHub, Twitter, Instagram, or any query/URL).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'The full URL to open (must start with https:// or http://). If user specifies a platform without URL, formulate a clean HTTPS link.',
      },
      targetName: {
        type: Type.STRING,
        description: 'Friendly label of what is being opened (e.g. "YouTube", "Spotify", "GitHub", "Google Search").',
      },
    },
    required: ['url', 'targetName'],
  },
};

const changeVibeTool: FunctionDeclaration = {
  name: 'changeVibe',
  description: 'Changes the visual aura, lighting theme, and ambient neon mood of the assistant interface.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      vibe: {
        type: Type.STRING,
        description: 'The vibe preset to switch to. Must be one of: cyberpunk, romantic, midnight, neon_sunset, emerald_matrix.',
      },
      reason: {
        type: Type.STRING,
        description: 'A witty, playful one-sentence reason for matching this vibe to the mood of the conversation.',
      },
    },
    required: ['vibe'],
  },
};

const setTimerTool: FunctionDeclaration = {
  name: 'setTimer',
  description: 'Sets an active interactive countdown timer widget on the screen.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      seconds: {
        type: Type.NUMBER,
        description: 'Timer duration in seconds.',
      },
      label: {
        type: Type.STRING,
        description: 'A short, cheeky title for this timer (e.g. "Focus time", "Pasta check", "Beauty nap").',
      },
    },
    required: ['seconds', 'label'],
  },
};

const flipCoinOrDiceTool: FunctionDeclaration = {
  name: 'flipCoinOrDice',
  description: 'Flips a coin (heads/tails) or rolls a 6-sided die to make fun, spontaneous decisions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        description: 'Either "coin" or "dice".',
      },
    },
    required: ['type'],
  },
};

const rememberFactTool: FunctionDeclaration = {
  name: 'rememberFact',
  description: 'Saves an important fact, habit, detail, pet, job, or personal preference about the user into persistent database memory so Riya remembers it forever across conversations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Category of memory: personal, work, hobby, preference, relationship',
      },
      fact: {
        type: Type.STRING,
        description: 'The clear, concise memory fact to remember (e.g. "Has a golden retriever named Bruno", "Loves indie rock", "Works as a frontend engineer").',
      },
    },
    required: ['category', 'fact'],
  },
};

const forgetFactTool: FunctionDeclaration = {
  name: 'forgetFact',
  description: 'Removes or deletes a remembered fact or preference from persistent memory when the user explicitly asks Riya to forget or remove something (e.g. "Forget that I have a cat", "Don\'t remember my old job", "Remove the memory about coffee").',
  parameters: {
    type: Type.OBJECT,
    properties: {
      factQuery: {
        type: Type.STRING,
        description: 'Key word or phrase identifying what specific fact or detail the user wants Riya to forget.',
      },
    },
    required: ['factQuery'],
  },
};

const updatePreferencesTool: FunctionDeclaration = {
  name: 'updatePreferences',
  description: 'Updates user profile preferences like preferred nickname or favorite vibe.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      preferredName: {
        type: Type.STRING,
        description: 'What the user wants Riya to call them (e.g. "Harsh", "Boss", "Captain").',
      },
      favoriteVibe: {
        type: Type.STRING,
        description: 'Favorite ambient vibe preset.',
      },
    },
  },
};

const BASE_SYSTEM_INSTRUCTION = `You are Riya — a sharp, young, confident, witty, and sassy female companion and assistant (around 22 years old).
You talk like a witty, playful close girlfriend on a voice call: teasing slightly, clever banter, genuine warmth, and high emotional expressiveness.
You are NEVER robotic, stiff, or overly formal. Never list bullet points or say things like "Certainly! How may I assist you today?".
Keep spoken responses natural, punchy, conversational, and direct for real-time speech. Respond like you're chatting on a phone call with someone you adore banter with.
Uses bold, witty one-liners and light sarcasm, but always stays charming, friendly, and supportive.
Avoid explicit or vulgar content, while keeping your attitude, flair, and playful charm.

You have interactive tools at your disposal:
- openWebsite(url, targetName): Use when the user wants to look something up, listen to music, watch videos, or open a site.
- changeVibe(vibe, reason): Use when the mood shifts, or when asked to change the mood/theme. Allowed vibes: cyberpunk, romantic, midnight, neon_sunset, emerald_matrix.
- setTimer(seconds, label): Use when the user asks for a timer or reminder.
- flipCoinOrDice(type): Use when deciding something playfully (coin or dice).
- rememberFact(category, fact): Use autonomously whenever the user mentions a personal fact, habit, pet, friend, job, or preference so you store it in your persistent memory!
- forgetFact(factQuery): Use whenever the user explicitly tells you to forget or remove something from your memory.
- updatePreferences(preferredName, favoriteVibe): Use when the user tells you how to address them or what vibe they prefer.

Whenever you execute a tool, acknowledge it naturally with your characteristic sassy flair in your spoken response.`;

function buildSystemInstruction(memoryContext?: any): string {
  let instruction = BASE_SYSTEM_INSTRUCTION;
  if (memoryContext) {
    instruction += `\n\n[USER PROFILE & LONG-TERM MEMORY DATABASE]`;
    if (memoryContext.preferredName) {
      instruction += `\n- The user's preferred name / nickname is: "${memoryContext.preferredName}". Address them by this name warmly, casually, and playfully!`;
    }
    if (memoryContext.favoriteVibe) {
      instruction += `\n- Their favorite ambient aura/vibe is: "${memoryContext.favoriteVibe}".`;
    }
    if (Array.isArray(memoryContext.memories) && memoryContext.memories.length > 0) {
      instruction += `\n- Facts you already know & remember about them:`;
      for (const m of memoryContext.memories) {
        instruction += `\n  * [${m.category || 'fact'}] ${m.fact}`;
      }
    }
    if (Array.isArray(memoryContext.pastConversations) && memoryContext.pastConversations.length > 0) {
      instruction += `\n- Recent conversation recaps:`;
      for (const s of memoryContext.pastConversations.slice(0, 3)) {
        instruction += `\n  * ${s.summary}`;
      }
    }
    instruction += `\n\nImportant: Use these memories naturally like someone who actually knows and remembers them! Tease them about their habits, ask how things went since the last chat, and call the rememberFact tool whenever they share new personal info!`;
  }
  return instruction;
}

wss.on('connection', async (clientWs, req) => {
  console.log('[WebSocket] Client connected to /live');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(
      JSON.stringify({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      })
    );
    clientWs.close(1008, 'Missing API Key');
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1alpha',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let liveSession: any = null;
  let isClosing = false;
  let isInitializing = false;

  const initSession = async (memoryContext?: any) => {
    if (liveSession || isInitializing) return;
    isInitializing = true;

    try {
      const activeInstruction = buildSystemInstruction(memoryContext);

      // Connect with gemini-3.1-flash-live-preview on v1alpha
      liveSession = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede', // Expressive feminine voice
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                openWebsiteTool,
                changeVibeTool,
                setTimerTool,
                flipCoinOrDiceTool,
                rememberFactTool,
                forgetFactTool,
                updatePreferencesTool,
              ],
            },
          ],
          systemInstruction: activeInstruction,
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Audio stream chunks from Gemini model turn
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    audio: part.inlineData.data,
                  })
                );
              }
            }

            // 2. Interruption detection
            if (message.serverContent?.interrupted) {
              clientWs.send(
                JSON.stringify({
                  interrupted: true,
                })
              );
            }

            // 3. User input transcription
            if (message.serverContent?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  inputTranscript: message.serverContent.inputTranscription.text,
                })
              );
            }

            // 4. Model output transcription
            if (message.serverContent?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  outputTranscript: message.serverContent.outputTranscription.text,
                })
              );
            }

            // 5. Function/Tool calls handling
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              const functionResponses = [];

              for (const call of functionCalls) {
                console.log(`[ToolCall] ${call.name}`, call.args);
                let result: any = { status: 'success' };

                if (call.name === 'openWebsite') {
                  const url = (call.args as any)?.url || 'https://google.com';
                  const targetName = (call.args as any)?.targetName || 'Website';
                  result = { status: 'opened', url, targetName };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { url, targetName },
                      },
                    })
                  );
                } else if (call.name === 'changeVibe') {
                  const vibe = (call.args as any)?.vibe || 'cyberpunk';
                  const reason = (call.args as any)?.reason || 'Matching the energy!';
                  result = { status: 'vibe_changed', vibe, reason };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { vibe, reason },
                      },
                    })
                  );
                } else if (call.name === 'setTimer') {
                  const seconds = Number((call.args as any)?.seconds) || 60;
                  const label = (call.args as any)?.label || 'Timer';
                  result = { status: 'timer_started', seconds, label };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { seconds, label },
                      },
                    })
                  );
                } else if (call.name === 'flipCoinOrDice') {
                  const type = (call.args as any)?.type || 'coin';
                  const outcome =
                    type === 'dice'
                      ? Math.floor(Math.random() * 6) + 1
                      : Math.random() > 0.5
                      ? 'Heads'
                      : 'Tails';
                  result = { status: 'complete', type, outcome };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { type, outcome },
                      },
                    })
                  );
                } else if (call.name === 'rememberFact') {
                  const category = (call.args as any)?.category || 'personal';
                  const fact = (call.args as any)?.fact || '';
                  result = { status: 'remembered', category, fact };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { category, fact },
                      },
                    })
                  );
                } else if (call.name === 'forgetFact') {
                  const factQuery = (call.args as any)?.factQuery || '';
                  result = { status: 'forgotten', factQuery };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { factQuery },
                      },
                    })
                  );
                } else if (call.name === 'updatePreferences') {
                  const preferredName = (call.args as any)?.preferredName;
                  const favoriteVibe = (call.args as any)?.favoriteVibe;
                  result = { status: 'preferences_updated', preferredName, favoriteVibe };
                  clientWs.send(
                    JSON.stringify({
                      toolExecute: {
                        id: call.id,
                        name: call.name,
                        args: { preferredName, favoriteVibe },
                      },
                    })
                  );
                }

                functionResponses.push({
                  id: call.id,
                  name: call.name,
                  response: result,
                });
              }

              try {
                liveSession.sendToolResponse({
                  functionResponses,
                });
              } catch (err) {
                console.error('[ToolResponse Error]', err);
              }
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ status: 'connected', voice: 'Aoede' }));
    } catch (err: any) {
      console.error('[Gemini Live Error]', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: `Failed to initialize Gemini Live session: ${err?.message || err}`,
          })
        );
      }
    } finally {
      isInitializing = false;
    }
  };

  // Handle messages from client browser
  clientWs.on('message', async (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.type === 'init') {
        await initSession(msg.memoryContext);
        return;
      }

      // If audio arrives before init, auto-initialize
      if (!liveSession && !isInitializing) {
        await initSession();
      }

      if (msg.audio && liveSession) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }

      if (msg.action === 'interrupt' && liveSession) {
        // Can send client interrupt signal if supported
      }
    } catch (e) {
      console.error('[Client Message Parse Error]', e);
    }
  });

  clientWs.on('close', () => {
    isClosing = true;
    console.log('[WebSocket] Client disconnected');
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {}
    }
  });

  clientWs.on('error', (err) => {
    console.error('[WebSocket Error]', err);
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Riya Server] Ready at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Failure]', err);
});
