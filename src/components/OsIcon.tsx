/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { getOSImage } from "@/lib/osImageHelper";

interface OsIconProps {
  os: string;
  className?: string;
}

export const OsIcon = React.memo(({ os, className = "w-3.5 h-3.5 min-w-[14px]" }: OsIconProps) => (
  <img
    src={getOSImage(os)}
    alt={os}
    className={`shrink-0 object-contain ${className}`}
  />
));

OsIcon.displayName = "OsIcon";
