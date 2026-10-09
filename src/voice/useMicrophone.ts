import { getCurrentScope, onScopeDispose, shallowRef, toValue, type MaybeRefOrGetter, type Ref, type ShallowRef } from 'vue';
import { getAudioContext } from './audio';

export type MicrophoneState = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported' | 'error';

export interface UseMicrophoneOptions {
  /**
   * Extra `getUserMedia` audio constraints. The defaults turn the browser's
   * voice processing off (echo cancellation, noise suppression, auto gain)
   * so the beam sees the real dynamics of the voice rather than a levelled
   * signal; pass `{}` to keep the browser defaults. Read on each `start()`.
   */
  constraints?: MaybeRefOrGetter<MediaTrackConstraints | undefined>;
  /** Ask for the microphone right away rather than waiting for `start()`. */
  autoStart?: boolean;
}

export interface UseMicrophoneResult {
  /** The live stream to hand to `<VoiceBeam :stream="…">`, or null. */
  stream: ShallowRef<MediaStream | null>;
  state: Ref<MicrophoneState>;
  /** The error behind a 'denied' / 'error' state, if any. */
  error: ShallowRef<Error | null>;
  /** True when this browser can capture audio at all. */
  supported: boolean;
  /** Request the microphone. Call it from a click so Safari lets audio start. */
  start: () => Promise<MediaStream | null>;
  /** Stop every track and drop the stream. */
  stop: () => void;
}

const DEFAULT_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Microphone access for VoiceBeam.
 *
 * ```vue
 * const mic = useMicrophone();
 * <button @click="mic.start">Listen</button>
 * <VoiceBeam :stream="mic.stream.value">…</VoiceBeam>
 * ```
 *
 * The stream is stopped when the calling scope (component) is disposed,
 * and when the browser ends the track (device unplugged, permission
 * revoked) the state falls back to 'idle'.
 */
export function useMicrophone(options: UseMicrophoneOptions = {}): UseMicrophoneResult {
  const { constraints, autoStart = false } = options;
  const stream = shallowRef<MediaStream | null>(null);
  const state = shallowRef<MicrophoneState>(isSupported() ? 'idle' : 'unsupported');
  const error = shallowRef<Error | null>(null);

  const stop = () => {
    const current = stream.value;
    stream.value = null;
    if (current) current.getTracks().forEach((t) => t.stop());
    state.value = isSupported() ? 'idle' : 'unsupported';
  };

  // The in-flight request, so a second click does not open a second device.
  let pending: Promise<MediaStream | null> | null = null;
  let disposed = false;

  const start = (): Promise<MediaStream | null> => {
    if (!isSupported()) {
      state.value = 'unsupported';
      return Promise.resolve(null);
    }
    if (stream.value) return Promise.resolve(stream.value);
    if (pending) return pending;

    // Create (and resume) the shared context inside the gesture that
    // triggered this, while the browser still allows it.
    getAudioContext();

    state.value = 'requesting';
    error.value = null;
    pending = (async () => {
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          audio: { ...DEFAULT_CONSTRAINTS, ...(toValue(constraints) ?? {}) },
        });
        // Granted after the owner went away (or stop() was called): release it.
        if (disposed || state.value !== 'requesting') {
          next.getTracks().forEach((t) => t.stop());
          return null;
        }
        stream.value = next;
        state.value = 'live';
        const onEnded = () => {
          if (stream.value !== next) return;
          stream.value = null;
          state.value = 'idle';
        };
        next.getAudioTracks().forEach((t) => t.addEventListener('ended', onEnded));
        return next;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        error.value = err;
        state.value = err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'error';
        return null;
      } finally {
        pending = null;
      }
    })();
    return pending;
  };

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      const current = stream.value;
      stream.value = null;
      if (current) current.getTracks().forEach((t) => t.stop());
    });
  }

  if (autoStart) void start();

  return { stream, state, error, supported: isSupported(), start, stop };
}
