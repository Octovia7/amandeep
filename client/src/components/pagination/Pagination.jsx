import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES } from '../../utils/format';

function pageWindow(page, total) {
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function Pagination({ pagination, onPage, onLimit }) {
  if (!pagination) return null;
  const { page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const from = totalItems ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, totalItems);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
      <div className="flex items-center gap-2 text-slate-500">
        <span>
          {from}–{to} of {totalItems}
        </span>
        <label className="flex items-center gap-1">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select className="input w-auto py-1" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-2" disabled={!hasPreviousPage} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`btn px-2.5 ${p === page ? 'bg-indigo-600 text-white' : 'btn-ghost'}`}
            >
              {p}
            </button>
          )
        )}
        <button className="btn-ghost px-2" disabled={!hasNextPage} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
