/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { resolveCountryCode } from "@/lib/regionCode";

interface FlagProps {
  flag: string;
  className?: string;
}

function resolveFlagFileName(flag: string): string {
  return resolveCountryCode(flag) ?? "UN";
}

export const Flag = React.memo(({ flag, className = "w-4 h-4" }: FlagProps) => {
  const resolvedFlagFileName = resolveFlagFileName(flag);
  const imgSrc = `/assets/flags/${resolvedFlagFileName}.svg`;
  const altText = `地区旗帜: ${resolvedFlagFileName}`;

  return (
    <span
      className={`inline-flex shrink-0 items-center self-center ${className}`}
      aria-label={altText}
    >
      <img
        src={imgSrc}
        alt={altText}
        className="h-full w-full object-contain"
      />
    </span>
  );
});

Flag.displayName = "Flag";
