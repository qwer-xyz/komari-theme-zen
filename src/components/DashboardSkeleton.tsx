/**
 * @license
 * SPDX-License-Identifier: MIT
 */

type DashboardSkeletonProps = {
  theme: "light" | "dark";
};

/** First-load placeholder that mirrors the header + node card grid. */
export function DashboardSkeleton(_props: DashboardSkeletonProps) {
  const block = "bg-zen-fill-muted/50";
  const cardBorder = "border-zen-line bg-zen-elevate";

  const Bar = ({ className = "" }: { className?: string }) => (
    <div className={`zen-skeleton rounded ${block} ${className}`} />
  );

  return (
    <div className="space-y-10 md:space-y-16" aria-hidden="true">
      <div className={`rounded-xl border ${cardBorder} p-5 md:p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <Bar className="h-5 w-40" />
          <Bar className="h-5 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-16" />
              <Bar className="h-7 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Bar className="h-3 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl border ${cardBorder} p-4 space-y-3`}
            >
              <div className="flex items-center gap-2">
                <Bar className="h-5 w-5 rounded-full" />
                <Bar className="h-4 flex-1" />
              </div>
              {Array.from({ length: 5 }).map((__, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Bar className="h-3 w-20" />
                  <Bar className="h-3 w-16" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
