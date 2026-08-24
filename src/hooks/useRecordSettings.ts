import { useMemo } from "react";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { buildPreserveHourPresets } from "@/lib/timeRangePresets";

export function useRecordSettings() {
  const { publicInfo } = usePublicInfo();

  return useMemo(() => {
    const recordEnabled = publicInfo?.record_enabled ?? false;
    const loadMaxHours = recordEnabled
      ? Math.max(1, publicInfo?.record_preserve_time ?? 0)
      : 0;
    const pingMaxHours = recordEnabled
      ? Math.max(1, publicInfo?.ping_record_preserve_time ?? 0)
      : 0;

    return {
      recordEnabled,
      loadMaxHours,
      pingMaxHours,
      loadPresets: buildPreserveHourPresets(loadMaxHours),
      pingPresets: buildPreserveHourPresets(pingMaxHours),
    };
  }, [publicInfo]);
}
