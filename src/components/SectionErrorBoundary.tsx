import React from "react";
import { useLangPreference } from "@/hooks/useLangPreference";
import { translations, type Lang } from "@/lib/i18n";
import { UIState } from "@/components/UIState";

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
    <UIState compact tone="warning" action={{ label: t.retry, onClick: retry, loading }}>
      {t.errorHistory}
    </UIState>
  );
}
function LoadFailure() {
  const { lang } = useLangPreference();
  const t = translations[lang];
  return (
    <UIState tone="warning" action={{ label: t.reloadPage, onClick: () => window.location.reload() }}>
      {t.errorSection}
    </UIState>
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
