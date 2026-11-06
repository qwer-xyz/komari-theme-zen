/**
 * @license
 * SPDX-License-Identifier: MIT
 */

type DashboardSkeletonProps = {
  theme: "light" | "dark";
  view?: "dashboard" | "detail";
};

/** First-load placeholder that mirrors the header + node card grid. */
export function DashboardSkeleton({ view = "dashboard" }: DashboardSkeletonProps) {
  const block = "bg-zen-fill-muted/50";
  const cardBorder = "border-zen-line bg-zen-elevate";

  const Bar = ({ className = "" }: { className?: string }) => (
    <div className={`zen-skeleton max-w-full rounded ${block} ${className}`} />
  );

  const mobileHeader = (
    <div className="km-mobile-site-header">
      <div className="flex items-center gap-2"><Bar className="h-7 w-7 shrink-0" /><Bar className="h-5 w-48" /></div>
      <div className="km-mobile-site-meta">
        <div className="km-mobile-site-clock"><Bar className="h-3 w-36" /><Bar className="h-2.5 w-24" /></div>
        <div className="km-mobile-site-actions"><div className="flex">{[0, 1, 2].map(index => <div key={index} className="flex h-11 w-11 items-center justify-center"><Bar className="h-4 w-4" /></div>)}</div></div>
      </div>
    </div>
  );

  if (view === "dashboard") {
    return (
      <div className="space-y-6 lg:space-y-11" aria-hidden="true">
        <div className="km-navbar-dashboard">
          {mobileHeader}
          <div className="km-dashboard-topbar">
            <div className="km-dashboard-brand space-y-2"><Bar className="h-7 w-56" /><Bar className="hidden h-3 w-48 lg:block" /></div>
            <div className="km-dashboard-desktop-clock gap-2"><Bar className="h-3 w-12" /><Bar className="h-4 w-44" /></div>
            <div className="km-dashboard-actions flex justify-end"><Bar className="h-8 w-36" /></div>
          </div>
          <div className="km-overview">
            <div className="km-overview-heroes">
              {[0, 1, 2].map(index => (
                <div key={index} className={`km-overview-hero km-overview-hero-${index}`}>
                  <div className="km-overview-reading space-y-3"><Bar className="h-3 w-20" /><Bar className="h-12 w-28" /></div>
                  {index > 0 ? <div className="km-overview-trend"><Bar className="h-10 w-full" /></div> : null}
                </div>
              ))}
            </div>
            <div className="km-overview-stats">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="km-overview-stat gap-2"><Bar className="h-3 w-16" /><Bar className="h-5 w-28" /></div>)}
            </div>
          </div>
        </div>
        <div className="space-y-6 lg:space-y-8">
          <div className="km-home-toolbar">
            <div className="km-toolbar-groups"><Bar className="h-9 w-80" /></div>
            <div className="km-toolbar-view"><Bar className="h-9 w-28" /></div>
            <Bar className="h-10 w-full" /><Bar className="h-9 w-12 lg:hidden" /><Bar className="h-9 w-16" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={`rounded-xl border ${cardBorder} p-4 sm:p-5`}>
                <div className="mb-5 flex items-center gap-2"><Bar className="h-5 w-5" /><Bar className="h-4 w-36" /></div>
                <div className="space-y-3">{Array.from({ length: 8 }, (_, row) => <div key={row} className="flex justify-between gap-4"><Bar className="h-3 w-12" /><Bar className="h-3 w-28" /></div>)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-hidden="true">
      {mobileHeader}
      <div className="flex items-center justify-between gap-6 py-2"><Bar className="h-6 w-56" /><Bar className="h-4 w-24" /></div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1].map(panel => (
          <div key={panel} className="zen-panel space-y-4 p-4 sm:p-5">
            <Bar className="h-4 w-24" />
            {Array.from({ length: 7 }, (_, row) => (
              <div key={row} className="flex justify-between gap-8"><Bar className="h-3 w-20" /><Bar className="h-3 w-40" /></div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-6 py-1"><Bar className="h-4 w-28" /><Bar className="h-8 w-48" /></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="zen-panel space-y-3 p-4">
            <div className="flex justify-between gap-6"><Bar className="h-4 w-24" /><Bar className="h-4 w-12" /></div>
            <Bar className="h-24 w-full" />
          </div>
        ))}
      </div>
      <div className="zen-panel space-y-4 p-4"><Bar className="h-4 w-28" /><Bar className="h-52 w-full" /><Bar className="h-11 w-full" /></div>
    </div>
  );
}
