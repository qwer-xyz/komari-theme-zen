/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { useParams } from "react-router-dom";

export default function PluginPage() {
  const params = useParams<{ short: string; "*": string }>();
  const short = params.short ?? "";
  const filepath = params["*"] ?? "";
  const encodedPath = filepath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const src = `/api/plugin/${encodeURIComponent(short)}/${encodedPath}`;

  return (
    <section className="km-page-plugin min-h-[65vh] overflow-hidden rounded-xl border border-zen-line bg-zen-surface">
      <iframe
        src={src}
        title={`${short} plugin`}
        className="km-plugin-frame block min-h-[65vh] w-full border-0 bg-transparent"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    </section>
  );
}
