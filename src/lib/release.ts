export const release = {
  version: "0.0.2",
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
};
