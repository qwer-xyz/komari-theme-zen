import { useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";

export function useKomariVersion() {
  const { call } = useRPC2Call();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    call<unknown, { version?: string }>("common:getVersion")
      .then((data) => {
        if (!cancelled && data?.version) {
          setVersion(data.version);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [call]);

  return version;
}
