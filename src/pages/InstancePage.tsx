/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useLayoutEffect } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { NodeDetail } from "@/components/NodeDetail";
import { translations } from "@/lib/i18n";
import { zenType } from "@/lib/typography";
import { zenText } from "@/lib/zenSemantics";
import type { AppOutletContext } from "@/layouts/AppLayout";

export default function InstancePage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { nodes, lang, theme } = useOutletContext<AppOutletContext>();
  const t = translations[lang];

  const node = nodes.find((n) => n.id === uuid);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [uuid]);

  const textMutedClass = `${zenText.subtle}/85`;
  const goBack = () => {
    if ((location.state as { fromDashboard?: boolean } | null)?.fromDashboard) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <section className="km-page-instance">
      {node ? (
        <div key={node.id}>
        <NodeDetail
          node={node}
          lang={lang}
          theme={theme}
          onBack={goBack}
        />
        </div>
      ) : (
        <div
          className={`py-12 text-center ${textMutedClass} uppercase zen-track-tight ${zenType.data} leading-relaxed font-mono space-y-4`}
        >
          <p>{t.selectVpsInput}</p>
          <button
            type="button"
            onClick={goBack}
            className="inline-block text-zen-accent hover:underline normal-case tracking-normal cursor-pointer bg-transparent border-0 font-inherit"
          >
            [ {t.backToList} ]
          </button>
        </div>
      )}
    </section>
  );
}
