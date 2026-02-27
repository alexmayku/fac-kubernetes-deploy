'use client';

import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import type { Summary } from '@/lib/schemas';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  onContextReady: (context: string) => void;
}

export const WelcomeView = ({
  onStartCall,
  onContextReady,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const payload = mode === 'url' ? { url } : { text };
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to summarize');
      }

      const data: Summary = await res.json();
      setSummary(data);
      onContextReady(JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputReady = mode === 'url' ? url.trim().length > 0 : text.trim().length > 0;

  return (
    <div ref={ref} className="relative h-full overflow-hidden">
      {/* Mesh Gradient Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 h-[400px] w-[400px] rounded-full bg-[#F9E8A0] opacity-40 blur-[120px]" />
        <div className="absolute -top-10 -right-20 h-[350px] w-[350px] rounded-full bg-[#F5C6C6] opacity-40 blur-[120px]" />
        <div className="absolute -bottom-20 -left-10 h-[300px] w-[300px] rounded-full bg-[#B8E6C8] opacity-40 blur-[120px]" />
        <div className="absolute -right-10 bottom-10 h-[500px] w-[500px] rounded-full bg-[#B8D4F0] opacity-30 blur-[120px]" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex h-full flex-col px-6 py-6">
        {/* Header */}
        <div className="text-foreground font-sans text-lg font-bold">.Stephen</div>

        {/* Center Content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <p className="text-foreground max-w-[500px] text-center font-serif text-[28px] leading-[1.6]">
            Hello. I&rsquo;m Stephen. Paste something in. I&rsquo;ll give you a call and ask you
            questions to help you find the gaps in your understanding.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('url')}
              className={`rounded-full px-4 py-1.5 font-mono text-xs transition-colors ${
                mode === 'url'
                  ? 'bg-[#1a1025] text-white'
                  : 'bg-neutral-200/60 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              URL
            </button>
            <button
              onClick={() => setMode('text')}
              className={`rounded-full px-4 py-1.5 font-mono text-xs transition-colors ${
                mode === 'text'
                  ? 'bg-[#1a1025] text-white'
                  : 'bg-neutral-200/60 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              Paste text
            </button>
          </div>

          {/* Input */}
          {mode === 'url' ? (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a Link Here"
              className="text-foreground w-full max-w-[400px] rounded-2xl border border-dashed border-neutral-300 bg-[#FDF9F3]/80 px-6 py-3 text-center font-mono text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none"
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your content here..."
              rows={5}
              className="text-foreground w-full max-w-[400px] rounded-2xl border border-dashed border-neutral-300 bg-[#FDF9F3]/80 px-4 py-3 font-mono text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none"
            />
          )}

          {/* Load button */}
          <button
            onClick={handleLoad}
            disabled={loading || !inputReady}
            className="rounded-full px-8 py-2 font-mono text-xs transition-all enabled:cursor-pointer enabled:bg-neutral-200 enabled:text-neutral-700 enabled:hover:bg-neutral-300 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {loading ? 'Summarizing...' : 'Load content'}
          </button>

          {/* Error */}
          {error && <p className="max-w-[400px] text-center text-sm text-red-500">{error}</p>}

          {/* Summary preview */}
          {summary && (
            <div className="w-full max-w-[400px] rounded-2xl border border-neutral-200 bg-white/60 px-5 py-4 text-left backdrop-blur-sm">
              <p className="text-foreground text-sm font-semibold">{summary.title}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">{summary.summary}</p>
            </div>
          )}

          {/* Start call button */}
          <button
            onClick={onStartCall}
            disabled={!summary}
            className="flex items-center gap-2 rounded-full px-8 py-3 font-mono text-sm text-white transition-all enabled:cursor-pointer enabled:bg-[#1a1025] enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-[#1a1025]/40"
          >
            Start Call
            <PhoneCall className="size-4" />
          </button>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-foreground/60 flex gap-4 font-mono text-xs tracking-[0.2em] uppercase">
            <span>MY CALLS</span>
            <span>&middot;</span>
            <span>LIBRARY</span>
          </div>
          <div className="text-foreground/60 font-mono text-xs tracking-[0.2em] uppercase">
            SETTINGS
          </div>
        </div>
      </div>
    </div>
  );
};
