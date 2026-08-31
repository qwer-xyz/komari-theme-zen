/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { resolveCountryCode } from "@/lib/regionCode";

interface FlagProps {
  flag: string;
  className?: string;
  label?: string;
}

function resolveFlagFileName(flag: string): string {
  return resolveCountryCode(flag) ?? "UN";
}

export const Flag = React.memo(({ flag, className = "w-4 h-4", label }: FlagProps) => {
  const resolvedFlagFileName = resolveFlagFileName(flag);
  const imgSrc = `/assets/flags/${resolvedFlagFileName}.svg`;

  return (
    <span
      className={`inline-flex shrink-0 items-center self-center ${className}`}
      role="img"
      aria-label={label || flag || resolvedFlagFileName}
    >
      <img
        src={imgSrc}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
});

Flag.displayName = "Flag";
