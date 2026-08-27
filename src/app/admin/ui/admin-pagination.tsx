"use client";


export interface AdminPaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  compact?: boolean;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export function AdminPagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  compact = false,
  pageSizeOptions = [20, 50, 100],
  itemLabel = "items",
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  const handleLimitSelect = (newLimit: number) => {
    try {
      localStorage.setItem("admin_rows_per_page", String(newLimit));
    } catch {}
    onLimitChange(newLimit);
    onPageChange(1);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 pt-2 pb-1 border-t border-line text-xs select-none">
        <span className="muted font-medium text-[11px]">
          {startItem}–{endItem} of {total}
        </span>

        <div className="flex items-center gap-1">
          <select
            aria-label="Rows per page"
            value={limit}
            onChange={(e) => handleLimitSelect(Number(e.target.value))}
            className="text-[11px] py-0.5 px-1.5 rounded border border-line bg-surface font-medium cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}/p
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="px-1.5 py-0.5 rounded border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
          >
            ‹
          </button>

          <span className="font-semibold px-1 text-[11px]">
            {page}/{totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="px-1.5 py-0.5 rounded border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-line mt-3 text-xs select-none">
      {/* Left Range info & Per page select */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="muted font-medium">
          {total === 0 ? (
            "No items found"
          ) : (
            <>
              Showing <strong className="text-ink">{startItem}</strong>–<strong className="text-ink">{endItem}</strong> of{" "}
              <strong className="text-ink">{total}</strong> {itemLabel}
            </>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="muted font-medium text-[11px]">Rows per page:</span>
          <select
            aria-label="Rows per page"
            value={limit}
            onChange={(e) => handleLimitSelect(Number(e.target.value))}
            className="py-1 px-2.5 rounded-lg border border-line bg-surface text-ink font-semibold cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-forest/30"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Pagination Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First Page"
          className="px-2 py-1 rounded-md border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
        >
          «
        </button>

        {/* Previous */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          title="Previous Page"
          className="px-2.5 py-1 rounded-md border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
        >
          ‹
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 px-1">
          {pageNumbers.map((num, idx) =>
            num === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 muted font-bold select-none">
                ...
              </span>
            ) : (
              <button
                key={num}
                type="button"
                aria-label={`Page ${num}`}
                aria-current={num === page ? "page" : undefined}
                onClick={() => onPageChange(num as number)}
                className={`min-w-[1.85rem] h-[1.85rem] px-2 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                  num === page
                    ? "bg-forest text-white shadow-xs border border-forest"
                    : "bg-surface text-ink border border-line hover:bg-surface-muted"
                }`}
              >
                {num}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          title="Next Page"
          className="px-2.5 py-1 rounded-md border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
        >
          ›
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          title="Last Page"
          className="px-2 py-1 rounded-md border border-line bg-surface text-ink disabled:opacity-30 font-bold hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
        >
          »
        </button>
      </div>
    </div>
  );
}

export interface AdminSidebarInfiniteFooterProps {
  displayed: number;
  total: number;
  onLoadMore?: () => void;
  itemLabel?: string;
}

export function AdminSidebarInfiniteFooter({
  displayed,
  total,
  onLoadMore,
  itemLabel = "items",
}: AdminSidebarInfiniteFooterProps) {
  const hasMore = displayed < total;

  return (
    <div className="flex items-center justify-between gap-2 pt-2.5 pb-1 border-t border-line text-xs select-none mt-auto">
      <span className="muted font-medium text-[11px]">
        Showing <strong className="text-ink">{displayed}</strong> of <strong className="text-ink">{total}</strong> {itemLabel}
      </span>

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="btn btn-secondary text-[11px] py-0.5 px-2 font-bold text-forest hover:bg-forest/10 border-forest/30 cursor-pointer"
        >
          Load More +
        </button>
      ) : (
        <span className="text-[10px] font-semibold muted italic">All {total} loaded</span>
      )}
    </div>
  );
}
