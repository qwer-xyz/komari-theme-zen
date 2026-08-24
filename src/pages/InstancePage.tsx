/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useLayoutEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { NodeDetail } from "@/components/NodeDetail";
import { useNodeRecent } from "@/hooks/useNodeRecent";
import { translations } from "@/lib/i18n";
import { zenType } from "@/lib/typography";
import { zenText } from "@/lib/zenSemantics";
import type { AppOutletContext } from "@/layouts/AppLayout";

export default function InstancePage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { nodes, lang, theme } = useOutletContext<AppOutletContext>();
  const t = translations[lang];

  const node = nodes.find((n) => n.id === uuid);
  const { records: recentRecords } = useNodeRecent(
    uuid ?? null,
    !!node?.online,
  );

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [uuid]);

  const textMutedClass = `${zenText.subtle}/85`;

  return (
    <section>
      {node ? (
        <div key={node.id}>
        <NodeDetail
          node={node}
          lang={lang}
          theme={theme}
          recentRecords={recentRecords}
          onBack={() => navigate("/")}
        />
        </div>
      ) : (
        <div
          className={`py-12 text-center ${textMutedClass} uppercase zen-track-tight ${zenType.data} leading-relaxed font-mono space-y-4`}
        >
          <p>{t.selectVpsInput}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-block text-zen-accent hover:underline normal-case tracking-normal cursor-pointer bg-transparent border-0 font-inherit"
          >
            [ {t.backToList} ]
          </button>
        </div>
      )}
    </section>
  );
}
