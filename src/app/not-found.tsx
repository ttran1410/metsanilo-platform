import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="storefront min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full card p-8 border border-line shadow-lg bg-surface rounded-3xl flex flex-col items-center gap-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-2">
          <strong className="text-xl font-bold tracking-wider text-ink">METSÄNILO</strong>
        </div>

        <div className="w-16 h-16 rounded-full bg-amber-100/80 border border-amber-200 flex items-center justify-center text-3xl">
          🌲
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-primary block">
            404 · NOT FOUND
          </span>
          <h1 className="text-2xl font-bold text-ink">
            Page Not Found
          </h1>
          <p className="text-xs muted leading-relaxed">
            The page you requested could not be located on Metsänilo.
          </p>
        </div>

        <div className="pt-3 w-full border-t border-line">
          <Link
            href="/fi"
            className="btn w-full text-xs font-bold py-3 px-6 rounded-xl shadow-sm text-center flex items-center justify-center gap-2"
          >
            <span>←</span> Return to Storefront
          </Link>
        </div>
      </div>
    </main>
  );
}
