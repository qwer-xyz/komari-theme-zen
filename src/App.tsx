/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { DetailPageSkeleton } from "@/components/DetailPageSkeleton";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const InstancePage = lazy(() => import("@/pages/InstancePage"));
const PluginPage = lazy(() => import("@/pages/PluginPage"));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <Suspense fallback={<DashboardSkeleton theme="light" />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="instance/:uuid"
          element={
            <Suspense fallback={<DetailPageSkeleton />}>
              <InstancePage />
            </Suspense>
          }
        />
        <Route
          path="plugin/:short/*"
          element={
            <Suspense fallback={<DetailPageSkeleton />}>
              <PluginPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
