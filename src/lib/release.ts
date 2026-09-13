export const release = {
  version: "0.0.2",
  // Manual Vercel CLI deployments do not always populate VERCEL_GIT_COMMIT_SHA.
  // Keep the explicit release SHA as the final deployment-controlled fallback.
  commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || process.env.RELEASE_COMMIT_SHA || "local",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
};
