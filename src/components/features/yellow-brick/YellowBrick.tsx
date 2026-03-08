'use client';

/**
 * YellowBrick — Primary command bar component.
 * The centrepiece of the ozskr.ai dashboard interaction paradigm.
 *
 * Design spec: 48px height, max-width 672px, 4px corner radius (brick, not pill).
 * Gold border (#F59E0B) with shimmer animation during processing.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Sparkles, X, Copy, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useYellowBrickStore } from './yellow-brick-store';
import { VoiceInput } from './VoiceInput';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.pdf', '.doc', '.docx', '.txt', '.md', '.csv',
];

const ACCEPTED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'text/csv',
].join(',');

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  dashboard: 'Talk to your agent...',
  calendar: 'Schedule content, ask about optimal times...',
  content: 'Generate content, describe what you need...',
  analytics: 'Ask about performance, get insights...',
  social: 'Manage your social presence...',
  settings: 'Configure your agent...',
};

const PROCESSING_MESSAGES = [
  'The wizard is working...',
  'Magic in progress...',
  'Almost there...',
];

const SLASH_COMMANDS = [
  { command: '/create', description: 'Create a new agent or content' },
  { command: '/schedule', description: 'Schedule a post or campaign' },
  { command: '/analytics', description: 'View performance insights' },
  { command: '/settings', description: 'Configure agent settings' },
  { command: '/help', description: 'Get help and documentation' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface YellowBrickInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  isProcessing: boolean;
  onVoiceTranscript: (text: string, isFinal: boolean) => void;
  interimTranscript: string;
}

function YellowBrickInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  isProcessing,
  onVoiceTranscript,
  interimTranscript,
}: YellowBrickInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex min-h-[48px] items-center gap-3 px-4">
      <Sparkles className="h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />

      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? '' : placeholder}
          disabled={isProcessing}
          rows={1}
          aria-label="Command input"
          aria-multiline="true"
          className={cn(
            'w-full resize-none bg-transparent text-sm leading-6 outline-none',
            'placeholder:font-normal placeholder:text-[#A1A1AA]',
            'font-medium text-white',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'overflow-hidden',
          )}
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 14 }}
        />
        {interimTranscript && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center text-sm italic text-[#71717A]"
            aria-hidden="true"
          >
            {interimTranscript}
          </span>
        )}
        {isProcessing && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center text-sm text-[#A1A1AA]"
            aria-live="polite"
            aria-atomic="true"
          >
            {PROCESSING_MESSAGES[Math.floor(Date.now() / 2000) % PROCESSING_MESSAGES.length]}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <VoiceInput onTranscript={onVoiceTranscript} />
        <KeyboardShortcutBadge />
      </div>
    </div>
  );
}

function KeyboardShortcutBadge() {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <kbd
      aria-label={isMac ? 'Command K' : 'Control K'}
      className={cn(
        'hidden items-center gap-[2px] rounded-sm border border-[#3F3F46]',
        'bg-[#27272A] px-1.5 py-0.5 font-mono text-[10px] text-[#71717A]',
        'select-none sm:inline-flex',
      )}
    >
      <span aria-hidden="true">{isMac ? '⌘' : 'Ctrl'}</span>
      <span aria-hidden="true">K</span>
    </kbd>
  );
}

function YellowBrickSuggestions({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (command: string) => void;
}) {
  if (!query.startsWith('/')) return null;

  const filtered = SLASH_COMMANDS.filter((c) =>
    c.command.startsWith(query.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Slash commands"
      className={cn(
        'absolute left-0 right-0 top-full z-50 mt-1',
        'overflow-hidden rounded-sm border border-[#3F3F46] bg-[#18181B]',
        'shadow-lg shadow-black/40',
      )}
    >
      {filtered.map((item) => (
        <li key={item.command} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onSelect(item.command + ' ')}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
              'text-[#A1A1AA] transition-colors hover:bg-[#27272A] hover:text-white',
              'focus-visible:bg-[#27272A] focus-visible:text-white focus-visible:outline-none',
            )}
          >
            <span className="font-mono text-[#F59E0B]">{item.command}</span>
            <span>{item.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function YellowBrickFileChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-0" aria-label="Attached files">
      {files.map((file, i) => (
        <span
          key={`${file.name}-${i}`}
          className={cn(
            'flex items-center gap-1.5 rounded-sm border border-[#3F3F46]',
            'bg-[#27272A] px-2.5 py-1 text-xs text-[#A1A1AA]',
          )}
        >
          <span className="max-w-[140px] truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${file.name}`}
            className="text-[#71717A] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F59E0B]"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

function AgentResponseStream({
  messages,
  isStreaming,
  streamError,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamError: string | null;
}) {
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastMessage = assistantMessages[assistantMessages.length - 1];

  if (!lastMessage && !isStreaming && !streamError) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="px-4 py-3 text-sm leading-relaxed text-[#E4E4E7]"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {streamError ? (
        <span className="text-[#F87171]">{streamError}</span>
      ) : (
        <span className="whitespace-pre-wrap">
          {lastMessage?.content ?? ''}
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-[#F59E0B] align-middle"
              aria-hidden="true"
            />
          )}
        </span>
      )}
    </div>
  );
}

function ResponseActions({
  content,
  onDismiss,
}: {
  content: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [content]);

  return (
    <div className="flex items-center gap-2 border-t border-[#27272A] px-4 py-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy response'}
        className={cn(
          'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors',
          'text-[#71717A] hover:text-[#A1A1AA]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F59E0B]',
        )}
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss response"
        className={cn(
          'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors',
          'text-[#71717A] hover:text-[#A1A1AA]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F59E0B]',
        )}
      >
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
        Dismiss
      </button>
    </div>
  );
}

function YellowBrickResponsePanel({
  messages,
  isStreaming,
  streamError,
  onDismiss,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamError: string | null;
  onDismiss: () => void;
}) {
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  const isVisible =
    isStreaming ||
    streamError !== null ||
    (lastMessage !== undefined && lastMessage.content.length > 0);

  if (!isVisible) return null;

  return (
    <div
      className="overflow-hidden border-t border-[#27272A] animate-in slide-in-from-top-2 duration-200"
      role="region"
      aria-label="Agent response"
    >
      <AgentResponseStream
        messages={messages}
        isStreaming={isStreaming}
        streamError={streamError}
      />
      {!isStreaming && lastMessage && lastMessage.content.length > 0 && (
        <ResponseActions content={lastMessage.content} onDismiss={onDismiss} />
      )}
    </div>
  );
}

function DropZoneOverlay() {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
        'rounded-[4px] border-2 border-dashed border-[#F59E0B] bg-[#F59E0B]/5',
      )}
      aria-hidden="true"
    >
      <span className="text-sm font-medium text-[#F59E0B]">Drop files here</span>
    </div>
  );
}

function getBorderStyle(
  isFocused: boolean,
  isProcessing: boolean,
  isError: boolean,
): React.CSSProperties {
  if (isError) {
    return { border: '1px solid #F87171', boxShadow: '0 0 12px rgba(248, 113, 113, 0.2)' };
  }
  if (isProcessing) {
    return { border: '1px solid #F59E0B' };
  }
  if (isFocused) {
    return { border: '1px solid #F59E0B', boxShadow: '0 0 30px rgba(245, 158, 11, 0.2)' };
  }
  return { border: '1px solid rgba(245, 158, 11, 0.4)' };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function YellowBrick() {
  const {
    isFocused,
    isProcessing,
    currentContext,
    attachedFiles,
    focus,
    blur,
    attachFile,
    removeFile,
  } = useYellowBrickStore();

  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isError, setIsError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placeholder =
    CONTEXT_PLACEHOLDERS[currentContext] ?? CONTEXT_PLACEHOLDERS['dashboard']!;

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeydown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        focus();
        containerRef.current?.querySelector('textarea')?.focus();
      }
      if (e.key === 'Escape') {
        blur();
        containerRef.current?.querySelector('textarea')?.blur();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [focus, blur]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const flashError = useCallback(() => {
    setIsError(true);
    if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setIsError(false);
      errorTimerRef.current = null;
    }, 1200);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isProcessing || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setStreamError(null);
    setIsStreaming(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: currentContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream') && response.body) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
        setMessages((prev) => [...prev, assistantMessage]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const parsed: unknown = JSON.parse(data);
                if (
                  parsed !== null &&
                  typeof parsed === 'object' &&
                  'content' in parsed &&
                  typeof (parsed as Record<string, unknown>)['content'] === 'string'
                ) {
                  const chunk = (parsed as { content: string }).content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: last.content + chunk };
                    }
                    return updated;
                  });
                }
              } catch {
                // Unparseable SSE line — skip
              }
            }
          }
        }
      } else {
        const data: unknown = await response.json();
        const content =
          data !== null &&
          typeof data === 'object' &&
          'content' in data &&
          typeof (data as Record<string, unknown>)['content'] === 'string'
            ? (data as { content: string }).content
            : 'Response received.';
        setMessages((prev) => [...prev, { role: 'assistant', content }]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message =
        err instanceof Error
          ? `Something went wrong: ${err.message}`
          : 'The agent is not available yet. Check back soon.';
      setStreamError(message);
      flashError();
    } finally {
      setIsStreaming(false);
    }
  }, [inputValue, isProcessing, isStreaming, messages, currentContext, flashError]);

  const handleSlashSelect = useCallback((command: string) => {
    setInputValue(command);
    containerRef.current?.querySelector('textarea')?.focus();
  }, []);

  const handleVoiceTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setInputValue((prev) => (prev ? `${prev} ${text}` : text));
      setInterimTranscript('');
    } else {
      setInterimTranscript(text);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setMessages([]);
    setStreamError(null);
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      Array.from(e.dataTransfer.files)
        .filter((file) => {
          const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
          return ACCEPTED_EXTENSIONS.includes(ext);
        })
        .forEach((file) => attachFile(file));
    },
    [attachFile],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      Array.from(e.target.files ?? []).forEach((file) => attachFile(file));
      e.target.value = '';
    },
    [attachFile],
  );

  const borderStyle = getBorderStyle(isFocused, isProcessing, isError);
  const hasResponse =
    messages.some((m) => m.role === 'assistant') || isStreaming || streamError !== null;

  return (
    <div
      className="relative w-full"
      style={{ maxWidth: 672 }}
      role="search"
      aria-label="Yellow Brick command bar"
    >
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden bg-[#18181B] transition-all duration-150',
          isProcessing && 'yb-processing',
        )}
        style={{ borderRadius: 4, ...borderStyle }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && <DropZoneOverlay />}

        <YellowBrickInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          isProcessing={isProcessing}
          onVoiceTranscript={handleVoiceTranscript}
          interimTranscript={interimTranscript}
        />

        <YellowBrickFileChips files={attachedFiles} onRemove={removeFile} />

        {hasResponse && (
          <YellowBrickResponsePanel
            messages={messages}
            isStreaming={isStreaming}
            streamError={streamError}
            onDismiss={handleDismiss}
          />
        )}
      </div>

      {isFocused && (
        <YellowBrickSuggestions query={inputValue} onSelect={handleSlashSelect} />
      )}

      <input
        type="file"
        id="yb-file-input"
        accept={ACCEPTED_MIME_TYPES}
        multiple
        className="sr-only"
        aria-label="Attach files"
        onChange={handleFileInputChange}
        tabIndex={-1}
      />

      <style>{`
        @keyframes ybWave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.0); }
        }
        @keyframes ybMicPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }
        .yb-processing {
          background: linear-gradient(90deg, #D97706, #F59E0B, #FBBF24, #F59E0B, #D97706);
          background-size: 200% 100%;
          animation: ybBorderShimmer 2s linear infinite;
          padding: 1px;
        }
        .yb-processing > * {
          background: #18181B;
          border-radius: 3px;
        }
        @keyframes ybBorderShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
