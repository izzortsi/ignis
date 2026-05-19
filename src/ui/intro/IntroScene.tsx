// Vendored from /workspace/ludus-ignis/src/ui/intro/IntroScene.tsx — same
// phase sequence, same scene-art layers. Decoupled from the ludus i18n dict
// and cinder-store: English text inlined (iteration 7 — the probability-tutor
// framing of the prelude is reworked out), and naming calls onComplete(name)
// to seed the run instead of writing a global store.

import { Show, createMemo, createSignal, onMount, onCleanup, createEffect, untrack } from 'solid-js';
import { Typewriter } from '../components/Typewriter';
import { SpeechPresentation, type SpeechPart } from '../map/SpeechPresentation';
import { collectMemory } from '../../core/run';
import {
  FRAMES, TWINKLE_FRAMES,
  CAMP_DIMS, RIO_DIMS, MIRROR_DIMS, type SceneDims,
  STAR_FIELD, STARS_MED_FRAMES, STARS_BRIGHT_FRAMES,
  AURORA_FRAMES, AURORA_FRAMES_COUNT,
  MOUNTAINS_FAR, MOUNTAINS_NEAR, GROUND,
  HUT_FRAME, APPRENTICE_IN_BED, SUN,
  HEARTH_PIT, HEARTH_FIRE_FRAMES,
  HEARTH_SMOKE_FRAMES, HEARTH_EMBER_FRAMES,
  BREEZE_FRAMES,
  CINDER_VESSEL, CINDER_FIRE_FRAMES, CINDER_KINDLE_FRAMES,
  CINDER_SMOKE_FRAMES, EMBER_FALL_FRAMES,
  RIO_MIYAKE, MIRROR_LEAK
} from './scene-art';
import { HieroglyphFigures } from './HieroglyphFigures';

const TICK_MS = 140;
const TYPE_MS = 32;

// Inlined English narration (iteration 7). The original text.two/three were a
// probability-tutor pitch ("words like maybe and probably… what they learned")
// — reworked here to pure cataclysm lore.
const INTRO = {
  skipHint: 'Space / Enter / click to continue · Tab to skip to naming · Esc straight to camp',
  morningSkipHint: '→ click or press → for the morning variant · Esc to camp',
  wakeText: 'Wake.',
  loreFinalHint: 'receive the ember →',
  elderSpeaker: 'The Elder Fire',
  text: {
    one: 'Listen. The fire is good tonight. Pull the hide closer.',
    two: 'There was an Age of Men — many, building with steel, the sky a friend.',
    three: 'Then the Sun turned against them, and would not settle. This is how it began.',
  },
  apprenticeDream: 'I had the strangest dream... and today, today is the Day of the Ritual.',
  lore: [
    'Come closer. Sit. The fire listens.',
    'There was an Age of Men. They were many. They built with steel, and the sky was a friend.',
    'But the Sun turned against them. It loosed the green serpent — and it still turns up there, where you can see.',
    'The cities went silent. The great waters swallowed what was left. The ancients died.',
    'We are the ones who stayed. Few, beneath the serpent.',
    'The fire is what remains to us of the ancients. Today, you receive yours.',
  ],
  subtitle: {
    walkingToFire: 'the Tender takes me to the Elder Fire.',
    arriving: 'the tribe gathers.',
    dancing: 'the dance begins.',
    receivingCinder: 'the ember passes.',
  },
  nameForm: {
    prompt: 'name your ember.',
    submit: 'name →',
    cinderSays: (name: string) => `"I am ${name}."`,
    begin: 'begin',
  },
};

type Phase =
  | 'text1' | 'flashback1'
  | 'text2' | 'flashback2'
  | 'text3'
  | 'wake_dream'
  | 'walking_to_fire'
  | 'arriving'
  | 'dancing'
  | 'lore_speech'
  | 'receiving_cinder'
  | 'black_wake'
  | 'morning'
  | 'test_morning';

const PHASE_ORDER: readonly Phase[] = [
  'text1', 'flashback1', 'text2', 'flashback2', 'text3',
  'wake_dream', 'walking_to_fire', 'arriving',
  'dancing', 'lore_speech', 'receiving_cinder',
  'black_wake', 'morning', 'test_morning'
];

const PHASE_DURATIONS: Partial<Record<Phase, number>> = {
  flashback1: 5500,
  flashback2: 5500
};

function textFor(phase: Phase): string | undefined {
  if (phase === 'text1') return INTRO.text.one;
  if (phase === 'text2') return INTRO.text.two;
  if (phase === 'text3') return INTRO.text.three;
  return undefined;
}

function loreParts(): SpeechPart[] {
  return INTRO.lore.map((line, i): SpeechPart => i === INTRO.lore.length - 1
    ? { text: line, variant: 'directive' }
    : { text: line });
}

function nextPhase(p: Phase): Phase | null {
  const i = PHASE_ORDER.indexOf(p);
  return i >= 0 && i + 1 < PHASE_ORDER.length ? PHASE_ORDER[i + 1] : null;
}

interface Props {
  onComplete: (name: string) => void;
}

interface LayerProps {
  art: string[] | string;
  className: string;
}

function Layer(props: LayerProps) {
  return (
    <pre class={`intro-layer ${props.className}`}>
      {typeof props.art === 'string' ? props.art : props.art.join('\n')}
    </pre>
  );
}

function IntroTypewriter(props: { text: string; position?: 'center' | 'bottom' }) {
  const pos = props.position ?? 'center';
  return (
    <div class={`intro-typewriter ${pos === 'bottom' ? 'is-bottom' : ''}`}>
      <p class="intro-typewriter-text">
        <Typewriter text={props.text} speedMs={TYPE_MS} />
      </p>
    </div>
  );
}

export function IntroScene(props: Props) {
  const [tick, setTick] = createSignal(0);
  const [phase, setPhase] = createSignal<Phase>('text1');
  const [nameInput, setNameInput] = createSignal('');
  const [nameChosen, setNameChosen] = createSignal(false);
  const [chosenName, setChosenName] = createSignal('');

  function submitName(e: SubmitEvent) {
    e.preventDefault();
    e.stopPropagation();
    const name = nameInput().trim();
    if (!name) return;
    setChosenName(name);
    setNameChosen(true);
  }

  onMount(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    onCleanup(() => clearInterval(id));
  });

  // Keyboard advances the intro too (not just clicking). Space / Enter /
  // ArrowRight mirror a click; keys are ignored while typing the Cinder's
  // name or on a button/form so naming and [begin] keep their own handling.
  onMount(() => {
    function onKey(e: KeyboardEvent) {
      // Esc always skips the whole rite straight to camp (uses the typed
      // name if any, else a default ember name). Handled before the
      // input-focus guard so it works even mid-naming.
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onComplete(chosenName().trim() || 'Ash');
        return;
      }
      // Tab skips the rite's lore but still drops you on the naming scene.
      if (e.key === 'Tab') {
        e.preventDefault();
        if (phase() !== 'morning' && phase() !== 'test_morning') setPhase('morning');
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && t.closest('input, textarea, button, form, .intro-naming')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        onClick();
      }
    }
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  let advanceTimer: number | null = null;
  function scheduleAutoAdvance() {
    if (advanceTimer !== null) clearTimeout(advanceTimer);
    const ms = PHASE_DURATIONS[phase()];
    if (ms == null) return;
    advanceTimer = window.setTimeout(() => {
      const n = nextPhase(phase());
      if (n) setPhase(n);
    }, ms);
  }
  createEffect(() => {
    phase();
    scheduleAutoAdvance();
  });
  onCleanup(() => {
    if (advanceTimer !== null) clearTimeout(advanceTimer);
  });

  function onClick() {
    if (phase() === 'lore_speech' || phase() === 'test_morning') return;
    const n = nextPhase(phase());
    if (n) setPhase(n);
  }

  function onBegin() {
    props.onComplete(chosenName());
  }

  const f           = createMemo(() => tick() % FRAMES);
  const starFrame   = createMemo(() => tick() % TWINKLE_FRAMES);
  const auroraFrame = createMemo(() => tick() % AURORA_FRAMES_COUNT);

  const [phaseEnteredTick, setPhaseEnteredTick] = createSignal(0);
  createEffect(() => {
    phase();
    setPhaseEnteredTick(untrack(tick));
  });
  const phaseTick = createMemo(() => tick() - phaseEnteredTick());

  // Seeing a flashback RECOVERS it into the persisted memory gallery (the
  // Memorial). collectMemory is deduped and needs no RunState (the Initiation
  // runs before a run exists).
  createEffect(() => {
    const p = phase();
    if (p === 'flashback1') collectMemory('rio-miyake');
    else if (p === 'flashback2') collectMemory('mirror-leak');
  });

  const isNightCamp = createMemo(
    () => phase() === 'walking_to_fire' || phase() === 'arriving'
       || phase() === 'dancing'         || phase() === 'lore_speech'
       || phase() === 'receiving_cinder'
  );
  const isMorningCamp = createMemo(() => phase() === 'morning');
  const isTestMorning = createMemo(() => phase() === 'test_morning');
  const isBedScene    = createMemo(() => phase() === 'wake_dream');
  const isBlackScene  = createMemo(() => phase() === 'black_wake');
  const isTextPhase   = createMemo(
    () => phase() === 'text1' || phase() === 'text2' || phase() === 'text3'
  );

  function dimsFor(p: Phase): SceneDims {
    if (p === 'flashback1') return RIO_DIMS;
    if (p === 'flashback2') return MIRROR_DIMS;
    return CAMP_DIMS;
  }
  const dims = createMemo(() => dimsFor(phase()));

  return (
    <div class={`intro-root ${isBlackScene() ? 'is-black' : ''} ${isBedScene() ? 'is-bed' : ''} ${isTestMorning() ? 'is-test-morning' : ''}`} onClick={onClick}>
      <div
        class={`intro-stage ${isBlackScene() ? 'is-black' : ''} ${isBedScene() ? 'is-bed' : ''} ${isTestMorning() ? 'is-test-morning' : ''}`}
        style={{
          '--cols': dims().cols,
          '--rows': dims().rows
        }}
      >
        <pre class="intro-filler">{Array(dims().rows).fill(' '.repeat(dims().cols)).join('\n')}</pre>

        <Show when={isBedScene()}>
          <Layer art={HUT_FRAME} className="intro-hut" />
          <Layer art={APPRENTICE_IN_BED} className="intro-bed-figure" />
        </Show>

        <Show when={isNightCamp()}>
          <Layer art={STAR_FIELD} className="intro-stars-base" />
          <Layer art={STARS_MED_FRAMES[starFrame()]} className="intro-stars-med" />
          <Layer art={STARS_BRIGHT_FRAMES[starFrame()]} className="intro-stars-bright" />
          <Layer art={AURORA_FRAMES[auroraFrame()]} className="intro-aurora" />
          <Layer art={MOUNTAINS_FAR} className="intro-mountains-far" />
          <Layer art={MOUNTAINS_NEAR} className="intro-mountains-near" />
          <Layer art={GROUND} className="intro-ground" />
          <Layer art={HEARTH_PIT} className="intro-hearth-pit" />

          <Layer art={HEARTH_FIRE_FRAMES[f()]} className="intro-hearth-fire" />
          <Layer art={HEARTH_EMBER_FRAMES[f()]} className="intro-hearth-embers" />
          <Layer art={HEARTH_SMOKE_FRAMES[f()]} className="intro-hearth-smoke" />
          <Layer art={BREEZE_FRAMES[f()]} className="intro-breeze" />

          <HieroglyphFigures phase={phase()} tick={tick()} phaseTick={phaseTick()} />

          <Show when={phase() === 'receiving_cinder'}>
            <Layer art={CINDER_VESSEL} className="intro-cinder-vessel" />
            <Layer art={EMBER_FALL_FRAMES[f()]} className="intro-ember-fall" />
            <Layer art={CINDER_KINDLE_FRAMES[f()]} className="intro-cinder-fire" />
          </Show>
        </Show>

        <Show when={phase() === 'flashback1'}>
          <Layer art={RIO_MIYAKE} className="intro-rio" />
        </Show>
        <Show when={phase() === 'flashback2'}>
          <Layer art={MIRROR_LEAK} className="intro-mirror" />
        </Show>

        <Show when={isMorningCamp()}>
          <Layer art={MOUNTAINS_FAR} className="intro-mountains-far is-morning" />
          <Layer art={MOUNTAINS_NEAR} className="intro-mountains-near is-morning" />
          <Layer art={GROUND} className="intro-ground" />
          <Layer art={HEARTH_PIT} className="intro-hearth-pit" />
          <Layer art={HEARTH_FIRE_FRAMES[f()]} className="intro-hearth-fire is-morning" />
          <Layer art={HEARTH_SMOKE_FRAMES[f()]} className="intro-hearth-smoke" />
          <Layer art={BREEZE_FRAMES[f()]} className="intro-breeze" />
          <HieroglyphFigures phase={phase()} tick={tick()} phaseTick={phaseTick()} />
          <Layer art={CINDER_VESSEL} className="intro-cinder-vessel" />
          <Layer art={CINDER_FIRE_FRAMES[f()]} className="intro-cinder-fire" />
          <Layer art={CINDER_SMOKE_FRAMES[f()]} className="intro-cinder-smoke" />
        </Show>

        <Show when={isTestMorning()}>
          <Layer art={SUN} className="intro-sun" />
          <Layer art={MOUNTAINS_FAR} className="intro-mountains-far is-test-morning" />
          <Layer art={MOUNTAINS_NEAR} className="intro-mountains-near is-test-morning" />
          <Layer art={GROUND} className="intro-ground is-test-morning" />
          <Layer art={HEARTH_PIT} className="intro-hearth-pit" />
          <Layer art={HEARTH_FIRE_FRAMES[f()]} className="intro-hearth-fire is-test-morning" />
          <Layer art={HEARTH_SMOKE_FRAMES[f()]} className="intro-hearth-smoke is-test-morning" />
          <Layer art={HEARTH_SMOKE_FRAMES[(f() + 5) % FRAMES]} className="intro-hearth-smoke is-test-morning is-extra" />
          <Layer art={HEARTH_SMOKE_FRAMES[(f() + 10) % FRAMES]} className="intro-hearth-smoke is-test-morning is-extra" />
          <Layer art={BREEZE_FRAMES[f()]} className="intro-breeze" />
          <HieroglyphFigures phase={phase()} tick={tick()} phaseTick={phaseTick()} />
          <Layer art={CINDER_VESSEL} className="intro-cinder-vessel is-test-morning" />
          <Layer art={CINDER_FIRE_FRAMES[f()]} className="intro-cinder-fire is-test-morning" />
          <Layer art={CINDER_SMOKE_FRAMES[f()]} className="intro-cinder-smoke is-test-morning" />
        </Show>
      </div>

      <Show when={isTextPhase()}>
        <IntroTypewriter text={textFor(phase())!} />
      </Show>

      <Show when={phase() === 'wake_dream'}>
        <IntroTypewriter text={INTRO.apprenticeDream} position="bottom" />
      </Show>

      <Show when={phase() === 'walking_to_fire'}>
        <p class="intro-subtitle">{INTRO.subtitle.walkingToFire}</p>
      </Show>

      <Show when={phase() === 'arriving'}>
        <p class="intro-subtitle">{INTRO.subtitle.arriving}</p>
      </Show>

      <Show when={phase() === 'dancing'}>
        <p class="intro-subtitle">{INTRO.subtitle.dancing}</p>
      </Show>

      <Show when={phase() === 'receiving_cinder'}>
        <p class="intro-subtitle">{INTRO.subtitle.receivingCinder}</p>
      </Show>

      <Show when={phase() === 'black_wake'}>
        <p class="intro-wake-text">{INTRO.wakeText}</p>
      </Show>

      <Show when={phase() === 'morning' || phase() === 'test_morning'}>
        <div class="intro-naming" onClick={(e) => e.stopPropagation()}>
          <Show
            when={nameChosen()}
            fallback={
              <form class="intro-name-form" onSubmit={submitName}>
                <p class="intro-name-prompt">{INTRO.nameForm.prompt}</p>
                <input
                  class="intro-name-input"
                  type="text"
                  value={nameInput()}
                  onInput={(e) => setNameInput(e.currentTarget.value)}
                  maxlength="20"
                  autocomplete="off"
                  spellcheck={false}
                  autofocus
                />
                <button type="submit" class="intro-begin" disabled={nameInput().trim().length === 0}>
                  {INTRO.nameForm.submit}
                </button>
              </form>
            }
          >
            <p class="intro-cinder-says">
              <em>{INTRO.nameForm.cinderSays(chosenName())}</em>
            </p>
            <button class="intro-begin" onClick={onBegin}>
              {INTRO.nameForm.begin}
            </button>
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'lore_speech'}>
        <SpeechPresentation
          speaker={INTRO.elderSpeaker}
          parts={loreParts()}
          finalHint={INTRO.loreFinalHint}
          onClose={() => setPhase('receiving_cinder')}
        />
      </Show>

      <Show when={phase() !== 'morning' && phase() !== 'test_morning' && phase() !== 'lore_speech'}>
        <p class="intro-skip-hint">{INTRO.skipHint}</p>
        <button
          class="intro-skip-name"
          onClick={(e) => {
            e.stopPropagation();
            setPhase('morning');
          }}
        >
          skip the rite — name your Cinder →
        </button>
      </Show>

      <Show when={phase() === 'morning'}>
        <p class="intro-skip-hint">{INTRO.morningSkipHint}</p>
      </Show>
    </div>
  );
}
