import { useEffect, useMemo, useRef } from 'react';
import { X, Mic2 } from 'lucide-react';
import type { Song } from '../types';

interface LrcLine { time: number; text: string }

const LRC_LINE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

/** Parses `[mm:ss.xx]lyric text` lines (possibly several timestamps sharing
 *  one line of text, e.g. a repeated chorus) into a flat, time-sorted list. */
function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const rawLine of raw.split('\n')) {
    const matches = Array.from(rawLine.matchAll(LRC_LINE));
    if (matches.length === 0) continue;
    const text = rawLine.replace(LRC_LINE, '').trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0;
      lines.push({ time: min * 60 + sec + frac, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

interface Props {
  song: Song;
  currentTime: number;
  accentColor: string;
  onClose: () => void;
}

export function LyricsModal({ song, currentTime, accentColor, onClose }: Props) {
  const activeRef = useRef<HTMLParagraphElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const isLrc = song.lyricsFormat === 'lrc';
  const lrcLines = useMemo(() => (isLrc && song.lyrics ? parseLrc(song.lyrics) : []), [isLrc, song.lyrics]);

  const activeIndex = useMemo(() => {
    if (!isLrc || lrcLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lrcLines.length; i++) { if (lrcLines[i].time <= currentTime) idx = i; else break; }
    return idx;
  }, [isLrc, lrcLines, currentTime]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="w-full max-w-md h-[70vh] rounded-2xl p-5 shadow-2xl animate-slide-up flex flex-col"
        style={{ background: 'rgba(24,24,24,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
        <div className="flex items-start justify-between mb-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg truncate">{song.title}</h3>
            <p className="text-white/40 text-xs truncate">{song.artist}</p>
          </div>
          <button onClick={onClose} className="btn-icon w-8 h-8 hover:bg-white/10 rounded-full shrink-0">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {!song.lyrics ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/25 gap-2">
            <Mic2 size={36} className="text-white/15" />
            <p className="font-medium">No lyrics found for this song</p>
          </div>
        ) : isLrc && lrcLines.length > 0 ? (
          <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-3 py-8">
            {lrcLines.map((line, i) => (
              <p key={i} ref={i === activeIndex ? activeRef : undefined}
                className="text-center transition-all duration-200 leading-snug"
                style={{
                  color: i === activeIndex ? accentColor : 'rgba(255,255,255,0.35)',
                  fontSize: i === activeIndex ? 17 : 15,
                  fontWeight: i === activeIndex ? 700 : 500,
                }}>
                {line.text || '\u00A0'}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{song.lyrics}</p>
          </div>
        )}
      </div>
    </div>
  );
}
