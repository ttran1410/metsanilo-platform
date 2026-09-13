import { afterEach, describe, expect, it, vi } from "vitest";

describe("release metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses RELEASE_COMMIT_SHA when the Vercel commit variable is empty", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("GIT_COMMIT_SHA", "");
    vi.stubEnv("RELEASE_COMMIT_SHA", "e991be6df3776799ab3cb4c5a3a0187fe03f10ea");

    const { release } = await import("@/lib/release");

    expect(release.commit).toBe("e991be6df3776799ab3cb4c5a3a0187fe03f10ea");
  });

  it("prefers the explicit release SHA over build-time Git metadata", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "vercel-commit");
    vi.stubEnv("RELEASE_COMMIT_SHA", "explicit-release");

    const { release } = await import("@/lib/release");

    expect(release.commit).toBe("explicit-release");
  });
});
