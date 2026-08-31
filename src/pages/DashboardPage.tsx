/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { NodeTable } from "@/components/NodeTable";
import type { AppOutletContext } from "@/layouts/AppLayout";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { nodes, lang, theme } = useOutletContext<AppOutletContext>();
  const selectNode = React.useCallback(
    (node: AppOutletContext["nodes"][number]) => {
      navigate(`/instance/${encodeURIComponent(node.id)}`, {
        state: { fromDashboard: true },
      });
    },
    [navigate],
  );

  return (
    <section className="km-page-home">
    <NodeTable
      nodes={nodes}
      selectedNodeId={null}
      onSelectNode={selectNode}
      lang={lang}
      theme={theme}
    />
    </section>
  );
}
