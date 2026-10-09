export { default as VoiceBeam } from './VoiceBeam.vue';
export { default } from './VoiceBeam.vue';

/** Whether this build carries the surface looks (`look="dots"` / `"lines"`), not released yet. */
export { __VOICE_SURFACE__ as VOICE_SURFACE_LOOKS } from './env';

export { useMicrophone } from './useMicrophone';
export type { UseMicrophoneOptions, UseMicrophoneResult, MicrophoneState } from './useMicrophone';

export { getAudioContext, isAudioSupported } from './audio';
export { parseRgb } from './color';

export { voiceDefaults, voiceTypePresets, voiceTypeStyle, resolveVoiceDefaults, resolveVoiceStyle } from './presets';
export type { VoiceGeometry, VoiceTypeStyle } from './presets';

export type {
  VoiceBeamProps,
  VoiceBeamEmits,
  VoiceBeamType,
  VoiceBeamTheme,
  VoiceBeamLook,
  VoiceBeamDotShape,
  VoiceBeamLinePattern,
  VoiceBeamColorVariant,
  VoiceBeamLevel,
  VoiceBeamMotion,
  VoiceThemeColors,
} from './types';

export { themePresets, voicePalettes, voiceLobes, LOBE_SPACING, LOBE_SPAN } from './styles';
export type { VoiceLobe } from './styles';
