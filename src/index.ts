// Everything except image (needs the `three` peer): import that from
// `vue-agent-fx/image`. Subpaths `./orbs`, `./beam`, `./voice` also exist.
export * from './orbs';
export * from './beam';
export { VoiceBeam, useMicrophone } from './voice';
export type * from './voice';
