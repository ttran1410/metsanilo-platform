import packageJson from "../../package.json";

export const release = {
  version: packageJson.version,
  // Manual Vercel CLI deployments do not always populate VERCEL_GIT_COMMIT_SHA.
  // Prefer the explicit release SHA so manual deployments cannot report a stale
  // build-time Git variable as the active release.
  commit: process.env.RELEASE_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "local",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
};
