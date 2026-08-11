// Build information baked into the bundle by build.mjs at build time via
// esbuild `define` (__BUILD_COMMIT__ / __BUILD_TIME__): the commit SHA comes
// from `git rev-parse` and the timestamp from the build clock. No pre-publish
// sync step needed. If the defines are absent (e.g. the file is executed
// without going through build.mjs), the values fall back to "unknown".
declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const BUILD_INFO = {
  commit: typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : "unknown",
  builtAt: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "unknown",
};
