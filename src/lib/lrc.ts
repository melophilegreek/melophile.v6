// Shared helpers for `[mm:ss.xx]lyric text` (LRC) timestamps. Import-time
// detection (scanner.ts) and the Lyrics modal's own live/manual-edit
// detection used to each keep a separate copy of this regex, which is how
// they quietly drifted apart and let some synced songs fall back to a flat
// block of plain text. One shared, non-anchored pattern for both.
export interface LrcLine { time: number; text: string }

const LRC_LINE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
// Non-global twin of LRC_LINE used purely for a yes/no "does this text carry
// timestamps" check — reusing the global regex for .test() would leave
// lastIndex in a bad state across calls.
const LRC_LINE_PROBE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/;

/** Does this text contain at least one `[mm:ss.xx]`-style timestamp
 *  anywhere? Intentionally not anchored to line start -- lyrics pasted,
 *  uploaded, or embedded by different taggers vary too much in leading
 *  whitespace/BOMs/etc. for an anchored check to be reliable. */
export function isLrcText(text: string | undefined | null): boolean {
  return !!text && LRC_LINE_PROBE.test(text);
}

export function detectLyricsFormat(text: string): 'lrc' | 'plain' {
  return isLrcText(text) ? 'lrc' : 'plain';
}

/** Parses `[mm:ss.xx]lyric text` lines (possibly several timestamps sharing
 *  one line of text, e.g. a repeated chorus) into a flat, time-sorted list. */
export function parseLrc(raw: string): LrcLine[] {
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
