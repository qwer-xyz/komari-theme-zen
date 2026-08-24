import { useEffect } from "react";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

function setMetaDescription(content: string) {
  let el = document.querySelector('meta[name="description"]');
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "description");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function useSiteMeta() {
  const { publicInfo } = usePublicInfo();

  useEffect(() => {
    const title = publicInfo?.sitename?.trim() || "Komari";
    document.title = title;

    const description =
      publicInfo?.description?.trim() ||
      "A simple server monitor tool.";
    setMetaDescription(description);
  }, [publicInfo?.sitename, publicInfo?.description]);
}
