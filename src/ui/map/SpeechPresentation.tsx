import { createSignal, createMemo, Show, onMount, onCleanup } from 'solid-js';
import { Typewriter } from '../components/Typewriter';

export interface SpeechPart {
  text: string;
  /** Optional display equation rendered under the text via KaTeX. */
  math?: string;
  /** Visual variant for special parts (e.g., directive: italic + centered). */
  variant?: 'directive';
}

interface Props {
  speaker: string;
  /** Title shown beside the speaker name (e.g., parable title). */
  title?: string;
  parts: SpeechPart[];
  /** Right-bottom hint text on the last part. Default: "fechar →". */
  finalHint?: string;
  /** Right-bottom hint while typing. Default: empty (just cursor pulses). */
  midHint?: string;
  /** Text inside the small "skip" link (top-right). If omitted, no skip. */
  skipLabel?: string;
  /** Called on close (last-tap or skip). */
  onClose: () => void;
}

// Bottom-overlay speech panel reused by both the Elder Fire (parable) and
// the Cinder (spontaneous theory walk-through). Tap LEFT half = back; tap
// RIGHT half = skip-current-paragraph if typing, else advance / close.
export function SpeechPresentation(props: Props) {
  const [partIdx, setPartIdx] = createSignal(0);
  const [skip, setSkip] = createSignal(false);
  const [partDone, setPartDone] = createSignal(false);
  const [instant, setInstant] = createSignal(false);

  // Clamp partIdx to the valid range — props.parts can shrink mid-flight if
  // the parent's memo recomputes (e.g., the Elder's parts switch from a
  // multi-paragraph parable to a one-line "studying" remark when stage
  // transitions during the same close gesture). Without the clamp,
  // currentPart() returns undefined and downstream `.math` access throws.
  const currentPart = createMemo(() => {
    const parts = props.parts;
    if (parts.length === 0) return null;
    const idx = Math.min(partIdx(), parts.length - 1);
    return parts[idx];
  });
  const isLastPart = createMemo(() => partIdx() >= props.parts.length - 1);
  const canGoBack = createMemo(() => partIdx() > 0);

  function goForward() {
    if (!partDone()) {
      setSkip(true);
      return;
    }
    if (isLastPart()) {
      props.onClose();
      return;
    }
    setSkip(false);
    setInstant(false);
    setPartDone(false);
    setPartIdx((i) => i + 1);
  }

  function goBack() {
    if (!canGoBack()) return;
    setSkip(false);
    setInstant(true);
    setPartDone(true);
    setPartIdx((i) => i - 1);
  }

  function onTap(e: MouseEvent) {
    const stage = e.currentTarget as HTMLDivElement;
    const rect = stage.getBoundingClientRect();
    const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
    if (isLeftHalf) goBack(); else goForward();
  }

  function onSkipClick(e: MouseEvent) {
    e.stopPropagation();
    props.onClose();
  }

  // Keyboard mirrors the click halves: Space / Enter / ArrowRight = forward
  // (skip typing, advance, or close on the last part); ArrowLeft = back.
  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <Show when={currentPart()}>
      {(part) => (
        <div
          class="speech-panel"
          onClick={onTap}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div class="speech-header">
            <span class="speech-speaker">{props.speaker}</span>
            <Show when={props.title}>
              <span class="speech-title">— {props.title}</span>
            </Show>
            <span class="speech-progress">
              {partIdx() + 1}/{props.parts.length}
            </span>
            <Show when={props.skipLabel}>
              <button class="speech-skip" onClick={onSkipClick}>{props.skipLabel}</button>
            </Show>
          </div>
          <p class={`speech-text ${part().variant === 'directive' ? 'is-directive' : ''}`}>
            <Show
              when={instant() || partDone()}
              fallback={
                <Typewriter
                  text={part().text}
                  speedMs={28}
                  skip={skip()}
                  onDone={() => setPartDone(true)}
                />
              }
            >
              {/* Once the text is fully revealed (or we're in instant/back mode),
                  swap to the markup-rendered version so inline italics and inline
                  math (`$\mid$`, etc.) actually render. */}
              <span innerHTML={renderInlineMarkup(part().text)} />
            </Show>
          </p>
          <div class="speech-nav">
            <span class="speech-nav-back">
              <Show when={canGoBack()}>← back</Show>
            </span>
            <span class="speech-nav-forward">
              <Show when={partDone()}>
                {isLastPart() ? (props.finalHint ?? 'close →') : 'next →'}
              </Show>
            </span>
          </div>
        </div>
      )}
    </Show>
  );
}

// === inline markup ===  *italic* → <em>. (Math/KaTeX dropped — iteration 7
// has no curriculum; the intro lore is plain prose.)

export function renderInlineMarkup(s: string): string {
  return escapeAndItalics(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAndItalics(s: string): string {
  return escapeHtml(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
