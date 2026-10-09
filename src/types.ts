/**
 * The nine shipped states, each a hand-tuned animation:
 * - `working`    particles on tilted orbits
 * - `searching`  a scan meridian sweeps a dotted globe
 * - `solving`    bands scramble in quarter turns, then click back
 * - `listening`  a waveform rolls through latitude rings
 * - `connecting` a constellation wires itself, packets running the edges
 * - `weaving`    three strands plait around the sphere
 * - `composing`  an undulating multi-band sash
 * - `breathing`  a face-on ring slowly morphing
 * - `shaping`    a dotted outline morphs circle → triangle → square
 */
export type OrbState =
  | 'working'
  | 'searching'
  | 'solving'
  | 'listening'
  | 'connecting'
  | 'weaving'
  | 'composing'
  | 'breathing'
  | 'shaping';

/** Two tuned presets (separate designs, not a scale factor): 64 avatar scale, 20 inline-text scale. */
export type OrbSize = 64 | 20;

/** `auto` reads ancestor data-theme / .dark|.light, then prefers-color-scheme. */
export type OrbTheme = 'auto' | 'dark' | 'light';

export interface ThinkingOrbProps {
  /** @default 'working' */
  state?: OrbState;
  /** @default 64 */
  size?: OrbSize;
  /** @default 'auto' */
  theme?: OrbTheme;
  /** Multiplier on the preset's baked speed. @default 1 */
  speed?: number;
  /** Freeze on the current frame. @default false */
  paused?: boolean;
  /** Overrides the per-state default label. */
  ariaLabel?: string;
}
