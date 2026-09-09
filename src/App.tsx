import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { DetailPageSkeleton } from "@/components/DetailPageSkeleton";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { useAnimatedRoute } from "@/hooks/useAnimatedRoute";

const loadDashboard = () => import("@/pages/DashboardPage");
const loadInstance = () => import("@/pages/InstancePage");
const loadPlugin = () => import("@/pages/PluginPage");
const DashboardPage = lazy(loadDashboard);
const InstancePage = lazy(loadInstance);
const PluginPage = lazy(loadPlugin);

export default function App() {
  const { pathname } = useLocation();
  const { rootRef, routeLocation } = useAnimatedRoute();
  useEffect(() => {
    const load = pathname.startsWith("/instance/")
      ? loadInstance
      : pathname.startsWith("/plugin/")
        ? loadPlugin
        : loadDashboard;
    // Begin code loading while the layout waits for API data. Render handles errors.
    void load().catch(() => {});
  }, [pathname]);
  return (
    <div ref={rootRef}>
      <Routes location={routeLocation}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <SectionErrorBoundary>
                <Suspense fallback={<DashboardSkeleton theme="light" />}>
                  <DashboardPage />
                </Suspense>
              </SectionErrorBoundary>
            }
          />
          <Route
            path="instance/:uuid"
            element={
              <SectionErrorBoundary>
                <Suspense fallback={<DetailPageSkeleton />}>
                  <InstancePage />
                </Suspense>
              </SectionErrorBoundary>
            }
          />
          <Route
            path="plugin/:short/*"
            element={
              <SectionErrorBoundary>
                <Suspense fallback={<DetailPageSkeleton />}>
                  <PluginPage />
                </Suspense>
              </SectionErrorBoundary>
            }
          />
        </Route>
      </Routes>
    </div>
  );
}
