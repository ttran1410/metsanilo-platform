"use client";

import { useState } from "react";
import { Copy, Languages } from "lucide-react";

export function BilingualEditor({
  nameFi,
  setNameFi,
  nameEn,
  setNameEn,
  descFi,
  setDescFi,
  descEn,
  setDescEn,
}: {
  nameFi: string;
  setNameFi: (val: string) => void;
  nameEn: string;
  setNameEn: (val: string) => void;
  descFi: string;
  setDescFi: (val: string) => void;
  descEn: string;
  setDescEn: (val: string) => void;
}) {
  const [activeLangTab, setActiveLangTab] = useState<"fi" | "en">("fi");

  const missingEn = !nameEn.trim() || !descEn.trim();

  function copyFiToEn() {
    if (!nameEn.trim()) setNameEn(nameFi);
    if (!descEn.trim()) setDescEn(descFi);
  }

  return (
    <div className="card p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="eyebrow">Storefront copy</span>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            Finnish and English
            {missingEn && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                English copy needed
              </span>
            )}
          </h3>
        </div>

        <button
          type="button"
          className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          onClick={copyFiToEn}
          title="Seed English inputs from Finnish text"
        >
          <Copy aria-hidden="true" /> Copy Finnish text
        </button>
      </div>

      <div className="admin-language-switch" role="tablist" aria-label="Storefront copy language">
        <button type="button" role="tab" aria-selected={activeLangTab === "fi"} className={activeLangTab === "fi" ? "is-active" : ""} onClick={() => setActiveLangTab("fi")}>
          <Languages aria-hidden="true" /> Finnish
        </button>
        <button type="button" role="tab" aria-selected={activeLangTab === "en"} className={activeLangTab === "en" ? "is-active" : ""} onClick={() => setActiveLangTab("en")}>
          <Languages aria-hidden="true" /> English {missingEn && <span className="admin-status-dot is-warning" aria-label="Copy incomplete" />}
        </button>
      </div>

      <div className="admin-bilingual-grid grid gap-4 md:grid-cols-2">
        {/* FINNISH COLUMN */}
        <div className={`admin-language-pane${activeLangTab === "fi" ? " is-mobile-active" : ""} flex flex-col gap-3 p-3.5 bg-surface-muted/40 rounded-xl border border-line`} role="tabpanel">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              Finnish (primary storefront copy)
            </span>
            <span className="text-[11px] muted font-medium">FI</span>
          </div>

          <label className="field">
            <span>Finnish Name</span>
            <input
              value={nameFi}
              onChange={(e) => setNameFi(e.target.value)}
              placeholder="e.g. Tuore Metsämustikka"
              required
            />
            <small className="muted text-right">{nameFi.length}/120 chars</small>
          </label>

          <label className="field">
            <span>Finnish Description</span>
            <textarea
              value={descFi}
              onChange={(e) => setDescFi(e.target.value)}
              rows={5}
              placeholder="Käsin poimittua tuoretta luomumustikkaa Satakunnan metsistä…"
            />
            <small className="muted text-right">{descFi.length}/5000 chars</small>
          </label>
        </div>

        {/* ENGLISH COLUMN */}
        <div className={`admin-language-pane${activeLangTab === "en" ? " is-mobile-active" : ""} flex flex-col gap-3 p-3.5 bg-surface-muted/40 rounded-xl border border-line`} role="tabpanel">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              English (international storefront copy)
              {(!nameEn.trim() || !descEn.trim()) && <span className="text-amber-600">●</span>}
            </span>
            <span className="text-[11px] muted font-medium">EN</span>
          </div>

          <label className="field">
            <span>English Name</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Fresh Wild Bilberry"
              required
            />
            <small className="muted text-right">{nameEn.length}/120 chars</small>
          </label>

          <label className="field">
            <span>English Description</span>
            <textarea
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              rows={5}
              placeholder="Freshly hand-picked wild bilberries harvested from pure forests…"
            />
            <small className="muted text-right">{descEn.length}/5000 chars</small>
          </label>
        </div>
      </div>
    </div>
  );
}
