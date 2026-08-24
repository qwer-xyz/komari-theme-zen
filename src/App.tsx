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
      </Route>
    </Routes>
  );
}
