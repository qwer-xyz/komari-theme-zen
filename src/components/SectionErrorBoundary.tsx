import React from "react";
import { useLangPreference } from "@/hooks/useLangPreference";
import { translations, type Lang } from "@/lib/i18n";

export function HistoryError({
  lang,
  retry,
  loading = false,
}: {
  lang: Lang;
  retry: () => void;
  loading?: boolean;
}) {
  const t = translations[lang];
  return (
    <div
      role="status"
      className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zen-warning/25 bg-zen-warning/5 px-4 py-3 text-sm text-zen-fg-muted"
    >
      <span>{t.errorHistory}</span>
      <button
        type="button"
        disabled={loading}
        onClick={retry}
        className="min-h-9 rounded px-3 font-medium text-zen-fg hover:bg-zen-fill-muted/10 disabled:opacity-50"
      >
        {t.retry}
      </button>
    </div>
  );
}
function LoadFailure() {
  const { lang } = useLangPreference();
  const t = translations[lang];
  return (
    <div
      role="alert"
      className="my-6 flex min-h-40 flex-col items-center justify-center gap-4 rounded-lg border border-zen-line bg-zen-surface p-6 text-zen-fg-muted"
    >
      <p>{t.errorSection}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-10 rounded-md border border-zen-line px-4 text-sm text-zen-fg hover:bg-zen-fill-muted/10"
      >
        {t.reloadPage}
      </button>
    </div>
  );
}
export class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  declare props: { children: React.ReactNode };
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <LoadFailure /> : this.props.children;
  }
}
