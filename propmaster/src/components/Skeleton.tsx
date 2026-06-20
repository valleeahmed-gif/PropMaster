import React from 'react';

// ── Skeleton primitives ────────────────────────────────────
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// ── Stat card skeleton ─────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-7 w-24 mb-2" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

// ── Dashboard skeleton ─────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="page-enter">
      {/* Welcome */}
      <div className="mb-6">
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[1,2,3,4].map(i => <StatCardSkeleton key={i} />)}
      </div>
      {/* Quick actions */}
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="card p-4 flex flex-col items-center gap-2">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Recent panels */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {[1,2].map(i => (
          <div key={i} className="card">
            <div className="px-5 py-4 border-b border-surface-100">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="p-2 space-y-1">
              {[1,2,3].map(j => (
                <div key={j} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-32 mb-1.5" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── List skeleton (rows) ───────────────────────────────────
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-surface-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-40 mb-2" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Page skeleton (generic) ────────────────────────────────
export function PageSkeleton() {
  return (
    <div className="page-enter">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

// ── Full-page spinner with branding ────────────────────────
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-100">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-9 h-9 rounded-full animate-spin"
          style={{
            borderWidth: 3,
            borderStyle: 'solid',
            borderColor: '#d2f3e5',
            borderTopColor: '#0e7c64',
          }}
          role="status"
          aria-label={label}
        />
        <p className="text-sm font-medium text-ink-500">{label}</p>
      </div>
    </div>
  );
}
