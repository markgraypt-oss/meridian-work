// Build information stamped into the production bundle at publish time.
// The local placeholder values below are overwritten by the pre-publish sync
// workflow with the actual commit SHA and build timestamp before `npm run build`
// runs, so esbuild bakes the real values into dist/index.js.
//
// In development (`npm run dev`), the placeholder values are served as-is,
// which is the expected and harmless behaviour.
export const BUILD_INFO = {
  commit: "unknown",
  builtAt: "unknown",
};
