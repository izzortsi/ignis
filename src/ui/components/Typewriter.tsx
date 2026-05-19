import { createSignal, createEffect, onCleanup, createMemo, Show } from 'solid-js';

interface Props {
  text: string;
  /** Default 32ms per char. */
  speedMs?: number;
  /** Fired when the full text is rendered (either naturally or via skip). */
  onDone?: () => void;
  /** When this becomes truthy, jump to the end of the text immediately. */
  skip?: boolean;
}

const DEFAULT_SPEED_MS = 32;

// Reveals text char by char. Restarts when `text` changes; jumps to end when
// `skip` becomes true. Emits `onDone` once when the full text is displayed.
export function Typewriter(props: Props) {
  const [shown, setShown] = createSignal(0);
  let intervalId: number | null = null;
  let lastDoneFor = '';

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function emitDone(text: string) {
    if (lastDoneFor === text) return;
    lastDoneFor = text;
    props.onDone?.();
  }

  // Restart whenever the text prop changes.
  createEffect(() => {
    const text = props.text;
    setShown(0);
    lastDoneFor = '';
    clearTimer();
    if (text.length === 0) {
      emitDone(text);
      return;
    }
    const speed = props.speedMs ?? DEFAULT_SPEED_MS;
    intervalId = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearTimer();
          emitDone(text);
          return n;
        }
        return n + 1;
      });
    }, speed);
  });

  // Skip → jump to end immediately.
  createEffect(() => {
    if (props.skip) {
      const text = props.text;
      clearTimer();
      setShown(text.length);
      emitDone(text);
    }
  });

  onCleanup(clearTimer);

  const isDone = createMemo(() => shown() >= props.text.length);

  return (
    <span class="typewriter">
      {props.text.slice(0, shown())}
      <Show when={!isDone()}>
        <span class="typewriter-cursor">_</span>
      </Show>
    </span>
  );
}
