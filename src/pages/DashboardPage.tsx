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

  return (
    <NodeTable
      nodes={nodes}
      selectedNodeId={null}
      onSelectNode={(node) => navigate(`/instance/${node.id}`)}
      lang={lang}
      theme={theme}
    />
  );
}
