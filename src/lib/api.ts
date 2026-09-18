import type { ApiProfile, GenerationPreset, MessageRole, TokenUsage } from '@/types';

export interface PromptMessage {
  role: MessageRole;
  content: string;
}

export interface CompletionRequest {
  profile: ApiProfile;
  preset: GenerationPreset;
  messages: PromptMessage[];
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
  maxTokens?: number;
  temperature?: number;
  /** Disables streaming regardless of the preset (used by background tasks). */
  forceNonStreaming?: boolean;
}

export interface CompletionResult {
  text: string;
  usage?: TokenUsage;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function defaultBaseUrl(provider: ApiProfile['provider']): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'google':
      return 'https://generativelanguage.googleapis.com';
    default:
      return 'https://api.openai.com/v1';
  }
}

export function resolveBaseUrl(profile: ApiProfile): string {
  return trimSlash(profile.baseUrl?.trim() || defaultBaseUrl(profile.provider));
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      return parsed?.error?.message ?? parsed?.message ?? text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

/** Reads an SSE body and hands each `data:` payload to the callback. */
async function readSse(response: Response, onEvent: (payload: string) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError('The response had no readable body');
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      for (const line of part.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload) onEvent(payload);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI compatible
// ---------------------------------------------------------------------------

async function completeOpenAi(request: CompletionRequest): Promise<CompletionResult> {
  const { profile, preset } = request;
  const stream = preset.streaming && !request.forceNonStreaming && Boolean(request.onDelta);
  const body: Record<string, unknown> = {
    model: profile.model,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: request.temperature ?? preset.temperature,
    top_p: preset.topP,
    max_tokens: request.maxTokens ?? preset.maxTokens,
    presence_penalty: preset.presencePenalty,
    frequency_penalty: preset.frequencyPenalty,
    stream,
  };
  if (preset.stop.length) body.stop = preset.stop.slice(0, 4);
  if (stream) body.stream_options = { include_usage: true };

  const response = await fetch(`${resolveBaseUrl(profile)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {}),
      ...profile.extraHeaders,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) throw new ApiError(await readError(response), response.status);

  if (!stream) {
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return {
      text: typeof text === 'string' ? text : '',
      usage: data?.usage
        ? { prompt: data.usage.prompt_tokens ?? 0, completion: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }

  let text = '';
  let usage: TokenUsage | undefined;
  await readSse(response, (payload) => {
    if (payload === '[DONE]') return;
    try {
      const data = JSON.parse(payload);
      if (data.usage) {
        usage = { prompt: data.usage.prompt_tokens ?? 0, completion: data.usage.completion_tokens ?? 0 };
      }
      const delta = data?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        text += delta;
        request.onDelta?.(delta);
      }
    } catch {
      /* keep-alive comments and partial frames are expected */
    }
  });
  return { text, usage };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

/** Anthropic wants a single system string and strictly alternating turns. */
function shapeAnthropic(messages: PromptMessage[]) {
  const system: string[] = [];
  const rest: PromptMessage[] = [];
  let leading = true;
  for (const message of messages) {
    if (message.role === 'system' && leading) {
      system.push(message.content);
      continue;
    }
    if (message.role !== 'system') leading = false;
    rest.push(message.role === 'system' ? { role: 'user', content: message.content } : message);
  }
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const message of rest) {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const last = merged[merged.length - 1];
    if (last && last.role === role) last.content += `\n\n${message.content}`;
    else merged.push({ role, content: message.content });
  }
  if (merged.length && merged[0].role === 'assistant') merged.unshift({ role: 'user', content: '(continue)' });
  if (!merged.length) merged.push({ role: 'user', content: '(begin)' });
  return { system: system.join('\n\n'), messages: merged };
}

async function completeAnthropic(request: CompletionRequest): Promise<CompletionResult> {
  const { profile, preset } = request;
  const stream = preset.streaming && !request.forceNonStreaming && Boolean(request.onDelta);
  const shaped = shapeAnthropic(request.messages);
  const body: Record<string, unknown> = {
    model: profile.model,
    system: shaped.system || undefined,
    messages: shaped.messages,
    max_tokens: request.maxTokens ?? preset.maxTokens,
    temperature: request.temperature ?? preset.temperature,
    top_p: preset.topP,
    stream,
  };
  if (preset.stop.length) body.stop_sequences = preset.stop;

  const response = await fetch(`${resolveBaseUrl(profile)}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...profile.extraHeaders,
    },
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) throw new ApiError(await readError(response), response.status);

  if (!stream) {
    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((part: { text?: string }) => part.text ?? '').join('')
      : '';
    return {
      text,
      usage: data?.usage
        ? { prompt: data.usage.input_tokens ?? 0, completion: data.usage.output_tokens ?? 0 }
        : undefined,
    };
  }

  let text = '';
  const usage: TokenUsage = { prompt: 0, completion: 0 };
  await readSse(response, (payload) => {
    try {
      const data = JSON.parse(payload);
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        text += data.delta.text;
        request.onDelta?.(data.delta.text);
      } else if (data.type === 'message_start') {
        usage.prompt = data.message?.usage?.input_tokens ?? 0;
      } else if (data.type === 'message_delta') {
        usage.completion = data.usage?.output_tokens ?? usage.completion;
      }
    } catch {
      /* ignore partial frames */
    }
  });
  return { text, usage: usage.prompt || usage.completion ? usage : undefined };
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

function shapeGoogle(messages: PromptMessage[]) {
  const system: string[] = [];
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      system.push(message.content);
      continue;
    }
    const role = message.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${message.content}`;
    else contents.push({ role, parts: [{ text: message.content }] });
  }
  if (!contents.length) contents.push({ role: 'user', parts: [{ text: '(begin)' }] });
  return { system: system.join('\n\n'), contents };
}

async function completeGoogle(request: CompletionRequest): Promise<CompletionResult> {
  const { profile, preset } = request;
  const stream = preset.streaming && !request.forceNonStreaming && Boolean(request.onDelta);
  const shaped = shapeGoogle(request.messages);
  const base = resolveBaseUrl(profile);
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${base}/v1beta/models/${encodeURIComponent(profile.model)}:${method}${
    stream ? '&' : '?'
  }key=${encodeURIComponent(profile.apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...profile.extraHeaders },
    body: JSON.stringify({
      contents: shaped.contents,
      systemInstruction: shaped.system ? { parts: [{ text: shaped.system }] } : undefined,
      generationConfig: {
        temperature: request.temperature ?? preset.temperature,
        topP: preset.topP,
        topK: preset.topK || undefined,
        maxOutputTokens: request.maxTokens ?? preset.maxTokens,
        stopSequences: preset.stop.length ? preset.stop : undefined,
      },
    }),
    signal: request.signal,
  });

  if (!response.ok) throw new ApiError(await readError(response), response.status);

  const pickText = (data: unknown): string => {
    const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content
      ?.parts;
    return parts?.map((part) => part.text ?? '').join('') ?? '';
  };
  const pickUsage = (data: unknown): TokenUsage | undefined => {
    const meta = (data as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
      ?.usageMetadata;
    return meta ? { prompt: meta.promptTokenCount ?? 0, completion: meta.candidatesTokenCount ?? 0 } : undefined;
  };

  if (!stream) {
    const data = await response.json();
    return { text: pickText(data), usage: pickUsage(data) };
  }

  let text = '';
  let usage: TokenUsage | undefined;
  await readSse(response, (payload) => {
    try {
      const data = JSON.parse(payload);
      const chunk = pickText(data);
      usage = pickUsage(data) ?? usage;
      if (chunk) {
        text += chunk;
        request.onDelta?.(chunk);
      }
    } catch {
      /* ignore partial frames */
    }
  });
  return { text, usage };
}

// ---------------------------------------------------------------------------

export async function complete(request: CompletionRequest): Promise<CompletionResult> {
  if (!request.profile) throw new ApiError('No connection profile is active');
  try {
    switch (request.profile.provider) {
      case 'anthropic':
        return await completeAnthropic(request);
      case 'google':
        return await completeGoogle(request);
      default:
        return await completeOpenAi(request);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(
      /failed to fetch|networkerror|load failed/i.test(message)
        ? `${message} — check the base URL, your network, and whether the endpoint allows browser requests (CORS).`
        : message,
    );
  }
}

export async function fetchModels(profile: ApiProfile): Promise<string[]> {
  const base = resolveBaseUrl(profile);
  if (profile.provider === 'google') {
    const response = await fetch(`${base}/v1beta/models?key=${encodeURIComponent(profile.apiKey)}`);
    if (!response.ok) throw new ApiError(await readError(response), response.status);
    const data = await response.json();
    return (data?.models ?? [])
      .map((model: { name?: string }) => model.name?.replace(/^models\//, '') ?? '')
      .filter(Boolean);
  }
  if (profile.provider === 'anthropic') {
    const response = await fetch(`${base}/v1/models`, {
      headers: {
        'x-api-key': profile.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!response.ok) throw new ApiError(await readError(response), response.status);
    const data = await response.json();
    return (data?.data ?? []).map((model: { id: string }) => model.id);
  }
  const response = await fetch(`${base}/models`, {
    headers: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {},
  });
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  const data = await response.json();
  return (data?.data ?? data?.models ?? []).map((model: { id?: string; name?: string }) => model.id ?? model.name ?? '');
}
