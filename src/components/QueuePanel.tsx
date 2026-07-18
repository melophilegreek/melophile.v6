import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2, Play, ListMusic, ChevronUp, ChevronDown, GripVertical, ListPlus } from 'lucide-react';
import type { Song } from '../types';
import { getArtUrl, useAlbumArtError } from './SongRow';
import { initialFor, placeholderBackground } from '../lib/artPlaceholder';

interface Props {
  queue: Song[];
  userQueueLen: number;
  currentSong: Song | null;
  accentColor: string;
  onClose: () => void;
  // BUG FIX (duplicates in queue): both callbacks now take the row's index
  // within `queue` rather than the song's id. When the same song is queued
  // more than once, every copy shares an id, so id-based lookups could only
  // ever act on "a" matching entry (or all of them) — never the specific one
  // the person clicked. Index addresses exactly one row.
  onPlayFromQueue: (song: Song, index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (from: number, to: number) => void;
  onClearQueue: () => void;
  /** Feature (swipe-to-queue inside the Queue panel): swiping an
   *  auto-queued row left-to-right explicitly adds that song to the user
   *  queue (same underlying player.addToQueue call the rest of the app
   *  uses), promoting it out of the passive "rest of the library" tail and
   *  into "Next Up" proper. */
  onQueueSong: (song: Song) => void;
}

export function QueuePanel({ queue, userQueueLen, currentSong, accentColor, onClose, onPlayFromQueue, onRemoveFromQueue, onReorderQueue, onClearQueue, onQueueSong }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Feature (Drag-to-reorder queue): pointer-based dragging (works for both
  // mouse and touch, unlike the HTML5 drag-and-drop API) driven from the
  // GripVertical handle. `dragIndex` is the row being dragged; `overIndex` is
  // whichever row the pointer is currently closest to — both are indices
  // into `queue`, restricted to the user-queued section (auto-queued rows
  // below aren't reorderable). The up/down chevron buttons are kept
  // alongside dragging as a precise, no-coordination-required fallback.
  //
  // FIX (drag animation quality): the dragged row now follows the pointer
  // continuously (translateY tracks the live offset instead of just an
  // opacity dim), and every row between the drag origin and the current
  // drop target visually slides out of the way by one row's worth of
  // space — the standard "make room" reorder animation — instead of only
  // an inset top-border line marking the target. Row positions are
  // snapshotted once at drag start so this is pure CSS transform math, not
  // a live layout read on every pointermove (which would fight itself once
  // rows start moving).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dragStartClientY = useRef(0);
  const dragSnapshot = useRef<Map<number, { top: number; height: number }>>(new Map());
  const rowStep = useRef(0);

  const handleGripPointerDown = useCallback((i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    const snapshot = new Map<number, { top: number; height: number }>();
    rowRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      snapshot.set(idx, { top: rect.top, height: rect.height });
    });
    dragSnapshot.current = snapshot;
    const cur = snapshot.get(i);
    const next = snapshot.get(i + 1);
    const prev = snapshot.get(i - 1);
    rowStep.current = next ? next.top - cur!.top : cur && prev ? cur.top - prev.top : cur?.height ?? 0;
    dragStartClientY.current = e.clientY;
    setDragOffsetY(0);
    setDragIndex(i);
    setOverIndex(i);
  }, []);

  useEffect(() => {
    if (dragIndex === null) return;
    const onMove = (e: PointerEvent) => {
      setDragOffsetY(e.clientY - dragStartClientY.current);
      let closest: number | null = null;
      let closestDist = Infinity;
      dragSnapshot.current.forEach((rect, idx) => {
        if (idx >= userQueueLen) return; // only the user-queued section is reorderable
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - center);
        if (dist < closestDist) { closestDist = dist; closest = idx; }
      });
      if (closest !== null) setOverIndex(closest);
    };
    const onUp = () => {
      setDragIndex((currentDrag) => {
        setOverIndex((currentOver) => {
          if (currentDrag !== null && currentOver !== null && currentDrag !== currentOver) {
            onReorderQueue(currentDrag, currentOver);
          }
          return null;
        });
        return null;
      });
      setDragOffsetY(0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragIndex, userQueueLen, onReorderQueue]);

  // Per-row visual shift while a drag is active: rows strictly between the
  // drag origin and the current drop target slide by one row-step to open
  // up a gap, in the direction the dragged row is moving.
  const shiftFor = useCallback((i: number): number => {
    if (dragIndex === null || overIndex === null || i === dragIndex) return 0;
    if (dragIndex < overIndex && i > dragIndex && i <= overIndex) return -rowStep.current;
    if (dragIndex > overIndex && i < dragIndex && i >= overIndex) return rowStep.current;
    return 0;
  }, [dragIndex, overIndex]);

  return (
    <div ref={ref} className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <ListMusic size={20} style={{ color: accentColor }} />
          <h2 className="text-white font-bold text-lg">Queue</h2>
          {queue.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${accentColor}25`, color: accentColor }}>{queue.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button onClick={onClearQueue} className="btn-icon w-8 h-8 hover:bg-red-500/15 rounded-lg" title="Clear queue">
              <Trash2 size={16} className="text-red-400/70 hover:text-red-400" />
            </button>
          )}
          <button onClick={onClose} className="btn-icon w-8 h-8 hover:bg-white/10 rounded-lg">
            <X size={18} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Now playing */}
      {currentSong && (
        <div className="px-4 py-3 shrink-0">
          <p className="text-xs text-white/30 uppercase tracking-wider font-semibold mb-2">Now Playing</p>
          <QueueRow song={currentSong} isCurrent accentColor={accentColor} onPlay={() => {}} />
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/25">
            <ListMusic size={40} className="mb-3 text-white/15" />
            <p className="font-medium">Queue is empty</p>
            <p className="text-xs mt-1">Swipe a song right to queue it</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/30 uppercase tracking-wider font-semibold mb-2 mt-2">Next Up</p>
            {queue.map((song, i) => {
              const isUserQueued = i < userQueueLen;
              const isBeingDragged = dragIndex === i;
              return (
              <div key={`${song.id}-${i}`}
                ref={(el) => { if (el) rowRefs.current.set(i, el); else rowRefs.current.delete(i); }}
                style={{
                  position: 'relative',
                  zIndex: isBeingDragged ? 10 : undefined,
                  transform: `translateY(${isBeingDragged ? dragOffsetY : shiftFor(i)}px)`,
                  transition: isBeingDragged ? 'none' : 'transform 0.2s cubic-bezier(0.2,0.8,0.2,1)',
                }}>
                <QueueRow
                  song={song}
                  accentColor={accentColor}
                  onPlay={() => onPlayFromQueue(song, i)}
                  onRemove={isUserQueued ? () => onRemoveFromQueue(i) : undefined}
                  onMoveUp={isUserQueued && i > 0 ? () => onReorderQueue(i, i - 1) : undefined}
                  onMoveDown={isUserQueued && i < userQueueLen - 1 ? () => onReorderQueue(i, i + 1) : undefined}
                  onGripPointerDown={isUserQueued ? handleGripPointerDown(i) : undefined}
                  onQueueSong={!isUserQueued ? () => onQueueSong(song) : undefined}
                  isDragging={isBeingDragged}
                  isDropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
                  index={i + 1}
                  isAutoQueued={!isUserQueued}
                />
              </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function QueueRow({ song, isCurrent, accentColor, onPlay, onRemove, onMoveUp, onMoveDown, onGripPointerDown, onQueueSong, isDragging, isDropTarget, index, isAutoQueued }: {
  song: Song; isCurrent?: boolean; accentColor: string;
  onPlay: () => void; onRemove?: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  onGripPointerDown?: (e: React.PointerEvent) => void;
  /** Feature (swipe-to-queue inside the Queue panel): present only on
   *  auto-queued rows (the passive "rest of the library" tail) — swiping
   *  one right promotes that song into the real, user-controlled queue. */
  onQueueSong?: () => void;
  isDragging?: boolean; isDropTarget?: boolean;
  index?: number; isAutoQueued?: boolean;
}) {
  const artUrl = getArtUrl(song);
  const { showArt, onError: onArtError } = useAlbumArtError(song, artUrl);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dy) > Math.abs(dx)) { dragging.current = false; return; }
    // Swipe left removes (user-queued rows); swipe right adds to the queue
    // (auto-queued rows). A row only ever has one of the two handlers, so
    // only the relevant direction actually moves the row.
    if (dx < 0 && onRemove) { e.preventDefault(); setDragX(Math.max(dx, -80)); }
    else if (dx > 0 && onQueueSong) { e.preventDefault(); setDragX(Math.min(dx, 80)); }
  };

  const onTouchEnd = () => {
    if (dragX < -40 && onRemove) { onRemove(); }
    else if (dragX > 40 && onQueueSong) { onQueueSong(); }
    setDragX(0); dragging.current = false;
  };

  const showQueueHint = onQueueSong && dragX > 10;

  return (
    <div className="relative overflow-hidden rounded-lg" style={{
      boxShadow: isDropTarget ? `inset 0 2px 0 0 ${accentColor}` : undefined,
    }}>
      {/* Remove background (swipe left) */}
      {onRemove && (
        <div className="absolute inset-0 flex items-center justify-end px-4"
          style={{ background: 'rgba(231,76,60,0.15)', opacity: dragX < -10 ? 1 : 0, transition: 'opacity 0.15s' }}>
          <Trash2 size={18} className="text-red-400" />
        </div>
      )}

      {/* Queue background (swipe right, auto-queued rows only) */}
      {onQueueSong && (
        <div className="absolute inset-0 flex items-center justify-start px-4"
          style={{ background: `${accentColor}15`, opacity: showQueueHint ? 1 : 0, transition: 'opacity 0.15s' }}>
          <div className="flex items-center gap-2" style={{ color: accentColor }}>
            <ListPlus size={16} />
            <span className="text-xs font-semibold">Queue</span>
          </div>
        </div>
      )}

      <div
        className="group flex items-center gap-2 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors px-2 -mx-2"
        style={{
          transform: `translateX(${dragX}px) ${isDragging ? 'scale(1.02)' : ''}`,
          transition: dragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.45)' : undefined,
          background: isDragging ? 'rgba(255,255,255,0.06)' : undefined,
        }}
        onClick={onPlay}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle / index */}
        <div className="w-5 shrink-0 flex items-center justify-center">
          {index !== undefined && !isCurrent && !isAutoQueued && (
            <div onPointerDown={onGripPointerDown} style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }} className="p-1 -m-1">
              <GripVertical size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
          )}
        </div>

        <div className="w-9 h-9 rounded-md shrink-0 overflow-hidden flex items-center justify-center" style={{ background: placeholderBackground(accentColor) }}>
          {showArt ? <img src={artUrl!} alt="" className="w-full h-full object-cover" onError={onArtError} /> : <span className="text-[11px] font-semibold" style={{ color: accentColor }}>{initialFor(song)}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: isCurrent ? accentColor : 'rgba(255,255,255,0.9)' }}>
            {song.title}
          </p>
          <p className="text-xs text-white/40 truncate">{song.artist}</p>
        </div>

        {/* Reorder buttons */}
        {!isCurrent && (onMoveUp || onMoveDown) && (
          <div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onMoveUp && (
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white">
                <ChevronUp size={12} />
              </button>
            )}
            {onMoveDown && (
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="w-5 h-4 flex items-center justify-center text-white/40 hover:text-white">
                <ChevronDown size={12} />
              </button>
            )}
          </div>
        )}

        {isCurrent && <Play size={14} fill={accentColor} style={{ color: accentColor }} className="shrink-0" />}

        {/* Remove button */}
        {onRemove && !isCurrent && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="btn-icon w-7 h-7 hover:bg-red-500/15 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <X size={14} className="text-red-400/70 hover:text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
}
