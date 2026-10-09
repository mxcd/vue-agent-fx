/* Upstream's build-time switch for the surface looks (`look="dots"` /
   `"lines"`), a Vite `define` there. This package ships source, so it is a
   plain constant here: off until upstream releases the looks; flip it to
   true for local work (see upstream LOOKS.md). Bundlers drop the dead
   branches either way. */
export const __VOICE_SURFACE__: boolean = false;
