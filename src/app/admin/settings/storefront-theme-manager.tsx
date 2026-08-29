"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, History, Palette, RotateCcw, Trash2 } from "lucide-react";
import { AdminConfirmDialog, AdminNotice } from "../presentation";
import type { StorefrontThemeKey } from "@/domain/storefront-themes";

type ThemeVersion = {
  id: string;
  version: number;
  themeKey: StorefrontThemeKey;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "DISCARDED";
  updatedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
};

type ThemeState = {
  publishedTheme: StorefrontThemeKey;
  draft: ThemeVersion | null;
  versions: ThemeVersion[];
};

const themes: Array<{
  key: StorefrontThemeKey;
  name: string;
  description: string;
  canvas: string;
  ink: string;
  accent: string;
  seasonal: string;
}> = [
  {
    key: "forest-harvest",
    name: "Forest harvest",
    description: "Default warm Finnish harvest with spruce, oat, and bilberry accents.",
    canvas: "#F7F7F2",
    ink: "#17201B",
    accent: "#14532D",
    seasonal: "#343A75",
  },
  {
    key: "nordic-ink",
    name: "Nordic ink",
    description: "A crisp neutral storefront with restrained forest accents.",
    canvas: "#FFFFFF",
    ink: "#101210",
    accent: "#244A3A",
    seasonal: "#66736B",
  },
  {
    key: "berry-season",
    name: "Berry season",
    description: "A light seasonal canvas with bilberry-led chapter details.",
    canvas: "#FAF5F7",
    ink: "#2A1821",
    accent: "#694055",
    seasonal: "#343A75",
  },
  {
    key: "arctic-mist",
    name: "Arctic mist",
    description: "A cool coastal canvas with pale blue-grey and spruce accents.",
    canvas: "#F3F7F8",
    ink: "#172A30",
    accent: "#24596A",
    seasonal: "#8DAEBA",
  },
  {
    key: "midnight-spruce",
    name: "Midnight spruce",
    description: "A calm dark Nordic storefront with spruce and warm berry light.",
    canvas: "#101715",
    ink: "#F2F5F1",
    accent: "#A6C6B2",
    seasonal: "#D7AA63",
  },
];

function themeName(themeKey: StorefrontThemeKey) {
  return themes.find((theme) => theme.key === themeKey)?.name ?? themeKey;
}

function formatPublishedAt(value: string | null) {
  if (!value) return "Initial configuration";
  return new Intl.DateTimeFormat("en-FI", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  }).format(new Date(value));
}

export function StorefrontThemeManager({ canManageTheme }: { canManageTheme: boolean }) {
  const [state, setState] = useState<ThemeState | null>(null);
  const [busy, setBusy] = useState<"load" | "draft" | "publish" | "discard" | "rollback" | null>("load");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  const [confirmation, setConfirmation] = useState<{ kind: "publish" | "rollback"; version?: ThemeVersion } | null>(null);

  const selectedTheme = state?.draft?.themeKey ?? state?.publishedTheme ?? "forest-harvest";
  const selectedDefinition = useMemo(
    () => themes.find((theme) => theme.key === selectedTheme) ?? themes[0],
    [selectedTheme],
  );

  async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? body.code ?? "Theme request failed");
    return body.data as ThemeState;
  }

  async function load() {
    try {
      setBusy("load");
      setState(await request("/api/admin/storefront-theme"));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Theme settings are unavailable");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    // Theme state is permission-scoped and loaded after the Admin workspace mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectTheme(themeKey: StorefrontThemeKey) {
    if (!canManageTheme || busy) return;
    try {
      setBusy("draft");
      const next = await request("/api/admin/storefront-theme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeKey }),
      });
      setState(next);
      setTone("success");
      setMessage(`${themeName(themeKey)} saved as draft. The live storefront has not changed.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save the theme draft");
    } finally {
      setBusy(null);
    }
  }

  async function publishDraft() {
    if (!state?.draft || !canManageTheme || busy) return;
    try {
      setBusy("publish");
      const draftId = state.draft.id;
      const next = await request(`/api/admin/storefront-theme/drafts/${draftId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      setState(next);
      setTone("success");
      setMessage(`${themeName(next.publishedTheme)} published to the storefront.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not publish the theme");
    } finally {
      setBusy(null);
    }
  }

  async function discardDraft() {
    if (!state?.draft || !canManageTheme || busy) return;
    try {
      setBusy("discard");
      const next = await request(`/api/admin/storefront-theme/drafts/${encodeURIComponent(state.draft.id)}`, {
        method: "DELETE",
      });
      setState(next);
      setTone("success");
      setMessage("Theme draft discarded. The published storefront was not changed.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not discard the draft");
    } finally {
      setBusy(null);
    }
  }

  async function restoreVersion(version: ThemeVersion) {
    if (!canManageTheme || busy) return;
    try {
      setBusy("rollback");
      const next = await request(`/api/admin/storefront-theme/versions/${version.id}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      setState(next);
      setTone("success");
      setMessage(`${themeName(next.publishedTheme)} restored and published as a new version.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not restore the theme version");
    } finally {
      setBusy(null);
    }
  }

  function requestPublish() {
    if (!state?.draft || !canManageTheme || busy) return;
    setConfirmation({ kind: "publish" });
  }

  function requestRestore(version: ThemeVersion) {
    if (!canManageTheme || busy) return;
    setConfirmation({ kind: "rollback", version });
  }

  async function confirmThemeAction() {
    const action = confirmation;
    setConfirmation(null);
    if (!action) return;
    if (action.kind === "publish") await publishDraft();
    else if (action.version) await restoreVersion(action.version);
  }

  if (!state && busy === "load") {
    return <div className="admin-state-card" role="status">Loading storefront themes…</div>;
  }

  if (!state) {
    return <AdminNotice tone="error">{message || "Theme settings are unavailable."}</AdminNotice>;
  }

  return (
    <div className="theme-manager">
      <div className="theme-manager-heading">
        <div>
          <span className="admin-section-icon" aria-hidden="true"><Palette /></span>
          <div>
            <h2>Frontstore themes</h2>
            <p>Choose a controlled design, preview the draft, then publish it when ready.</p>
          </div>
        </div>
        <div className="theme-published-status">
          <span>Published</span>
          <strong>{themeName(state.publishedTheme)}</strong>
        </div>
      </div>

      {message && <AdminNotice tone={tone} live>{message}</AdminNotice>}
      {!canManageTheme && (
        <AdminNotice>Read-only access. The <code>theme.manage</code> permission is required to draft or publish themes.</AdminNotice>
      )}

      <div className="theme-manager-grid">
        <section className="theme-preview-panel" aria-labelledby="theme-preview-title">
          <div className="theme-preview-toolbar">
            <div>
              <span>{state.draft ? `Draft version ${state.draft.version}` : "Published theme"}</span>
              <strong id="theme-preview-title">{selectedDefinition.name}</strong>
            </div>
            {state.draft && <span className="admin-status-badge admin-status-warning">Not live</span>}
          </div>
          <div className="theme-live-preview storefront" data-theme={selectedTheme}>
            <div className="theme-preview-nav"><strong>METSÄNILO</strong><span>Suomeksi · English</span></div>
            <div className="theme-preview-hero">
              <span>Satakunnan luonnonmarjat</span>
              <h3>Tuoreita metsämarjoja suoraan poimijalta</h3>
              <p>Paikallinen sato, selkeä varaus ja maksu vasta noudettaessa.</p>
              <i>Varaa marjoja</i>
            </div>
            <div className="theme-preview-harvest"><span>Seuraava nouto</span><strong>Huomenna · 42 l jäljellä</strong></div>
          </div>
          <a
            className="btn btn-secondary theme-preview-link"
            href={`/fi?theme-preview=${encodeURIComponent(selectedTheme)}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview full storefront <ExternalLink aria-hidden="true" />
          </a>
        </section>

        <section className="theme-lifecycle-panel" aria-label="Theme selection and publishing">
          <div className="theme-choice-list" role="radiogroup" aria-label="Controlled storefront themes">
            {themes.map((theme) => {
              const selected = selectedTheme === theme.key;
              const published = state.publishedTheme === theme.key;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-choice${selected ? " is-selected" : ""}`}
                  key={theme.key}
                  disabled={!canManageTheme || Boolean(busy)}
                  onClick={() => void selectTheme(theme.key)}
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {[theme.canvas, theme.ink, theme.accent, theme.seasonal].map((color) => <i key={color} style={{ backgroundColor: color }} />)}
                  </span>
                  <span className="theme-choice-copy">
                    <strong>{theme.name}</strong>
                    <small>{theme.description}</small>
                    {published && <em>Currently published</em>}
                  </span>
                  <span className="theme-choice-check" aria-hidden="true">{selected && <Check />}</span>
                </button>
              );
            })}
          </div>

          <div className="theme-publish-actions">
            <div>
              <strong>{state.draft ? "Draft ready for review" : "No unpublished changes"}</strong>
              <span>{state.draft ? "Publishing changes the customer-facing theme immediately." : "Choose a different theme to create a versioned draft."}</span>
            </div>
            {state.draft && canManageTheme && (
              <div>
                <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => void discardDraft()}>
                  <Trash2 aria-hidden="true" /> Discard
                </button>
                <button type="button" className="btn" disabled={Boolean(busy)} onClick={requestPublish}>
                  {busy === "publish" ? "Publishing…" : "Publish theme"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="theme-history" aria-labelledby="theme-history-title">
        <div>
          <History aria-hidden="true" />
          <div><h3 id="theme-history-title">Publication history</h3><p>Rollback always creates a new audited version.</p></div>
        </div>
        {state.versions.length ? (
          <div className="theme-history-list">
            {state.versions.map((version) => (
              <article key={version.id}>
                <div><strong>Version {version.version} · {themeName(version.themeKey)}</strong><span>{formatPublishedAt(version.publishedAt)}{version.publishedBy ? ` · ${version.publishedBy}` : ""}</span></div>
                <span className={`admin-status-badge ${version.status === "PUBLISHED" ? "admin-status-success" : "admin-status-neutral"}`}>{version.status === "PUBLISHED" ? "Published" : "Previous"}</span>
                {version.status === "SUPERSEDED" && canManageTheme && (
                  <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => requestRestore(version)}>
                    <RotateCcw aria-hidden="true" /> Restore
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="theme-history-empty">The first publication will appear here.</p>
        )}
      </section>

      <AdminConfirmDialog
        open={confirmation !== null}
        eyebrow={confirmation?.kind === "rollback" ? "Restore theme" : "Publish theme"}
        title={confirmation?.kind === "rollback" ? `Restore ${confirmation.version ? themeName(confirmation.version.themeKey) : "theme"}?` : `Publish ${state.draft ? themeName(state.draft.themeKey) : "this theme"}?`}
        description={confirmation?.kind === "rollback" ? `Version ${confirmation.version?.version} will be published as a new live version.` : "This changes the customer-facing storefront immediately."}
        confirmLabel={confirmation?.kind === "rollback" ? "Restore and publish" : "Publish theme"}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmThemeAction}
      />
    </div>
  );
}
