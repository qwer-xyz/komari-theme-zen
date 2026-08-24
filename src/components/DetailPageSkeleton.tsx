/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";

/** Route-level placeholder while the instance detail chunk loads. */
export function DetailPageSkeleton() {
  const block = "bg-zen-fill-muted/50";

  const Bar = ({ className = "" }: { className?: string }) => (
    <div className={`zen-skeleton rounded ${block} ${className}`} />
  );

  return (
    <div className="space-y-8 pt-1 pb-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Bar className="h-8 w-20" />
        <Bar className="h-6 w-6 rounded-full" />
        <Bar className="h-7 flex-1 max-w-xs" />
      </div>

      <div className="grid grid-cols-1 gap-x-16 gap-y-8 md:grid-cols-2 pt-2">
        <div className="space-y-4">
          <Bar className="h-4 w-36" />
          <div className="grid grid-cols-2 gap-y-3 pb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <React.Fragment key={i}>
                <Bar className="h-3.5 w-24" />
                <Bar className="h-3.5 w-32 justify-self-end" />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Bar className="h-4 w-28" />
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Bar className="h-3.5 w-28" />
                  <Bar className="h-3.5 w-16" />
                </div>
                <Bar className="h-1 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
