import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  mode: "test",
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const numeric = await vite.ssrLoadModule("/src/lib/numeric.ts");
const queryCache = await vite.ssrLoadModule("/src/lib/queryCache.ts");
const recordTransform = await vite.ssrLoadModule("/src/lib/recordTransform.ts");
const rpc2 = await vite.ssrLoadModule("/src/lib/rpc2.ts");
const colorScheme = await vite.ssrLoadModule(
  "/src/lib/colorScheme/resolveScheme.ts",
);
const colorSchemeSettings = await vite.ssrLoadModule("/src/lib/colorScheme/fromTheme.ts");
const colorSchemeApplication = await vite.ssrLoadModule("/src/lib/colorScheme/applyScheme.ts");
const sanitizeHtml = await vite.ssrLoadModule("/src/lib/sanitizeHtml.ts");
const dashboardTrend = await vite.ssrLoadModule("/src/lib/dashboardTrend.ts");
const fontScheme = await vite.ssrLoadModule(
  "/src/lib/fontScheme/resolveFont.ts",
);
const pingSeries = await vite.ssrLoadModule("/src/lib/pingChartSeries.ts");
const queue = await vite.ssrLoadModule("/src/lib/requestQueue.ts");
const gpuSampler = await vite.ssrLoadModule("/src/lib/sampleGpuRecords.ts");
const liveGpu = await vite.ssrLoadModule("/src/lib/liveGpu.ts");
const residual = await vite.ssrLoadModule("/src/lib/residualValue.ts");
const billingDisplay = await vite.ssrLoadModule("/src/lib/billingDisplay.ts");
const timeRangePresets = await vite.ssrLoadModule("/src/lib/timeRangePresets.ts");
const themeSettings = await vite.ssrLoadModule("/src/hooks/useThemeSettings.ts");
const nodeSort = await vite.ssrLoadModule("/src/lib/nodeSort.ts");
const colorPresets = await vite.ssrLoadModule("/src/lib/colorScheme/presets.ts");
const chartTooltip = await vite.ssrLoadModule("/src/lib/chartTooltip.ts");

test("chart tooltips stay visible at phone viewport edges and after scrolling", () => {
  const viewport = { width: 320, height: 568 };
  const tooltip = { width: 270, height: 160 };
  for (const top of [-100, 0, 200, 550, 700]) {
    for (const left of [-20, 0, 200]) {
      for (const xRatio of [0, 0.5, 1]) {
        for (const yRatio of [0, 0.5, 1]) {
          const position = chartTooltip.chartTooltipPosition({ left, top, width: 290, height: 200 }, tooltip, viewport, xRatio, yRatio);
          assert(position.left >= 12 && position.left + tooltip.width <= viewport.width - 12);
          assert(position.top >= 12 && position.top + tooltip.height <= viewport.height - 12);
        }
      }
    }
  }
  const leftEdge = chartTooltip.chartTooltipPosition({ left: 0, top: 200, width: 320, height: 100 }, tooltip, viewport, 0, 0.5);
  const rightEdge = chartTooltip.chartTooltipPosition({ left: 0, top: 200, width: 320, height: 100 }, tooltip, viewport, 1, 0.5);
  assert(leftEdge.left < rightEdge.left);
});

const billingLabels = {
  unitDays: "天",
  billingFree: "免费",
  billingExpired: "已到期",
  billingLongTerm: "长期",
  billingNoInfo: "—",
  billingHidden: "-",
  billingNotSet: "未设置",
  billingMonthly: "月",
  billingQuarterly: "季",
  billingSemiAnnual: "半年",
  billingAnnual: "年",
  billingBiennial: "两年",
  billingTriennial: "三年",
  billingQuinquennial: "五年",
  billingOnce: "次",
  billingCycleDays: "天",
};

function billingNode(overrides = {}) {
  return {
    price: 7.79,
    currency: "$",
    billingCycle: 30,
    expiredAt: "",
    ...overrides,
  };
}

test("same-currency value survives an unavailable exchange service", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const rates = await residual.loadResidualExchangeRates("CNY", ["CNY"]);
    assert.equal(rates.rates.CNY, 1);
    assert.equal(rates.source, "Local");
    const nodes = [
      {
        id: "paid",
        name: "paid",
        price: 30,
        billingCycle: 30,
        currency: "CNY",
        expiredAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      },
      { id: "free", name: "free", price: -1, currency: "CNH" },
      {
        id: "foreign",
        name: "foreign",
        price: 30,
        billingCycle: 30,
        currency: "USD",
        expiredAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      },
    ];
    const summary = residual.computeResidualValueSummary(nodes, "CNY", {});
    assert.equal(summary.includedCount, 1);
    assert(summary.totalValue > 0);
    assert(summary.excludedNodes.some((node) => node.reason === "free"));
    assert(
      summary.excludedNodes.some((node) => node.reason === "missing_rate"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GPU gaps stay empty instead of drawing across an outage", () => {
  const records = [0, 1000, 2000, 3_600_000, 3_601_000].map((offset) => ({
    time: new Date(1_700_000_000_000 + offset).toISOString(),
    utilization: 20,
    mem_used: 10,
    mem_total: 100,
  }));
  const sampled = gpuSampler.sampleGpuRecords(records);
  assert(
    sampled.some(
      (record) => record.utilization === null && record.mem_used === null,
    ),
  );
  assert(sampled.includes(records[2]) && sampled.includes(records[3]));
});

test("live GPU status keeps the flat Komari 1.5 fields and rejects GPU-less nodes", () => {
  const detailed = [
    {
      name: "Phoenix1",
      memory_total: 24 * 1024 ** 3,
      memory_used: 6 * 1024 ** 3,
      utilization: 87.5,
      temperature: 61,
    },
  ];
  assert.deepEqual(
    liveGpu.parseLiveGpu({
      gpu: 87.5,
      gpu_count: 1,
      gpu_average_usage: 87.5,
      gpu_detailed_info: detailed,
    }),
    { count: 1, average_usage: 87.5, detailed_info: detailed },
  );

  // `gpu` stays 0 and the detail fields are omitted for nodes without a card.
  assert.equal(liveGpu.parseLiveGpu({ gpu: 0 }), undefined);
  assert.equal(
    liveGpu.parseLiveGpu({ gpu: 0, gpu_average_usage: 0, gpu_count: 0 }),
    undefined,
  );
  // An idle card still reports its presence through the count.
  assert.deepEqual(liveGpu.parseLiveGpu({ gpu: 0, gpu_count: 2 }), {
    count: 2,
    average_usage: 0,
    detailed_info: [],
  });

  // Older builds nested the same shape under `gpu`, and before 1.5 it was a
  // flat usage number with no device detail at all.
  assert.deepEqual(
    liveGpu.parseLiveGpu({
      gpu: { count: 1, average_usage: 12.5, detailed_info: detailed },
    }),
    { count: 1, average_usage: 12.5, detailed_info: detailed },
  );
  assert.deepEqual(liveGpu.parseLiveGpu({ gpu: 12.5 }), {
    count: 0,
    average_usage: 12.5,
    detailed_info: [],
  });

  // A missing count falls back to the reported devices, and junk is dropped
  // rather than turned into a fake card.
  const parsed = liveGpu.parseLiveGpu({
    gpu: 0,
    gpu_count: 1,
    gpu_detailed_info: [{ name: "Phoenix1", memory_total: 1024 }, "junk"],
  });
  assert.equal(parsed.count, 1);
  assert.equal(parsed.detailed_info.length, 1);
  assert.deepEqual(parsed.detailed_info[0], {
    name: "Phoenix1",
    memory_total: 1024,
    memory_used: 0,
    utilization: 0,
    temperature: 0,
  });
  assert.deepEqual(
    liveGpu.parseLiveGpu({ gpu: 0, gpu_detailed_info: [{ name: "a" }, { name: "b" }] })
      .detailed_info.map((device) => device.name),
    ["a", "b"],
  );
});

test("a GPU reading prefers the live sample and falls back to the stored record", () => {
  const gib = (value) => value / 1024 ** 3;
  const live = {
    name: "Phoenix1",
    memory_total: 24 * 1024 ** 3,
    memory_used: 6 * 1024 ** 3,
    utilization: 80,
    temperature: 61,
  };
  const recorded = {
    client: "node-1",
    time: "2026-09-09T00:00:00Z",
    device_index: 0,
    device_name: "Phoenix1",
    mem_total: 24 * 1024 ** 3,
    mem_used: 3 * 1024 ** 3,
    utilization: 40,
    temperature: 50,
  };
  // Both sources measure memory in bytes, so the card reads the same either way.
  const fromLive = liveGpu.resolveGpuReading(live, recorded);
  assert.equal(fromLive.memTotal, recorded.mem_total);
  assert.equal(gib(fromLive.memUsed), 6);
  assert.equal(fromLive.temperature, 61);
  const fromRecord = liveGpu.resolveGpuReading(undefined, recorded);
  assert.equal(gib(fromRecord.memUsed), 3);
  assert.equal(fromRecord.temperature, 50);
  // An agent that could not read the card must not blank out a known total.
  assert.equal(
    liveGpu.resolveGpuReading({ ...live, memory_total: 0 }, recorded).memTotal,
    recorded.mem_total,
  );
  assert.equal(liveGpu.resolveGpuReading(undefined, undefined), undefined);
});

test("live GPU devices are addressed the way the backend indexes them", () => {
  const gpu = {
    count: 2,
    average_usage: 10,
    detailed_info: [{ name: "first" }, { name: "second" }],
  };
  assert.equal(liveGpu.liveGpuDeviceAt(gpu, 0).name, "first");
  assert.equal(liveGpu.liveGpuDeviceAt(gpu, 1).name, "second");
  assert.equal(liveGpu.liveGpuDeviceAt(gpu, 2), undefined);
  assert.equal(liveGpu.liveGpuDeviceAt(gpu, -1), undefined);
  assert.equal(liveGpu.liveGpuDeviceAt(undefined, 0), undefined);
});

test("prototype names cannot select a font or color preset", () => {
  for (const value of ["constructor", "toString", "__proto__", "missing"]) {
    assert.equal(fontScheme.normalizeFontPresetId(value), "Default");
    assert.doesNotThrow(() =>
      colorScheme.resolveColorScheme({ presetId: value, mode: "light" }),
    );
    assert.doesNotThrow(() =>
      fontScheme.resolveFontScheme({
        presetId: value,
        customFamily: "",
        customCssUrl: "",
      }),
    );
  }
  assert.deepEqual(
    fontScheme.resolveFontScheme({
      presetId: "System",
      customFamily: "",
      customCssUrl: "",
    }).cssUrls,
    [],
  );
  assert.deepEqual(
    fontScheme.resolveFontScheme({
      presetId: "Custom",
      customFamily: "Arial",
      customCssUrl: "",
    }).cssUrls,
    [],
  );
});

test("histories distinguish missing metrics from zero and anchor to source time", () => {
  const time = "2026-09-09T00:00:00Z";
  const totals = { memTotal: 100, swapTotal: 0, diskTotal: 100 };
  const history = recordTransform.buildAllMetricHistories(
    1,
    totals,
    [{ time, cpu: 0, ram: null }],
    [],
  );
  assert.equal(history.cpu.hasData, true);
  assert.equal(history.cpu.values.at(-1), 0);
  assert.equal(history.mem.hasData, false);
  assert.equal(history.temp.hasData, false);
  assert(history.temp.values.every((value) => value === null));
  assert.equal(history.cpu.timestamps.at(-1), Date.parse(time));
  const later = recordTransform.buildAllMetricHistories(
    1,
    totals,
    [{ time: "2026-09-09T00:30:00Z", cpu: 10 }],
    [],
  );
  assert.equal(later.cpu.values.length, history.cpu.values.length);
  assert.equal(
    later.cpu.timestamps.at(-1) - history.cpu.timestamps.at(-1),
    30 * 60_000,
  );
});

test("history capacity falls back to node metadata without inventing measurements", () => {
  for (const [metric, usedKey, totalKey, fallbackKey] of [
    ["mem", "ram", "ram_total", "memTotal"],
    ["disk", "disk", "disk_total", "diskTotal"],
    ["swap", "swap", "swap_total", "swapTotal"],
  ]) {
    const totals = { [fallbackKey]: 200 };
    for (const unavailable of [0, null, undefined, -1, NaN, Infinity, "", "0", "bad"]) {
      const record = { [usedKey]: 50, [totalKey]: unavailable };
      assert.equal(recordTransform.loadMetricValue(record, metric, totals), 25);
      assert.equal(recordTransform.loadMetricValue({ ...record, [usedKey]: 0 }, metric, totals), 0);
      assert.equal(recordTransform.loadMetricValue({ ...record, [usedKey]: null }, metric, totals), null);
      assert.equal(recordTransform.loadMetricValue({ ...record, [usedKey]: undefined }, metric, totals), null);
      assert.equal(recordTransform.loadMetricValue(record, metric, { [fallbackKey]: 0 }), null);
    }
    assert.equal(recordTransform.loadMetricValue({ [usedKey]: 50, [totalKey]: 100 }, metric, totals), 50);
    assert.equal(recordTransform.loadMetricValue({ [usedKey]: "50", [totalKey]: "100" }, metric, totals), 50);
  }
});

test("persisted zero-total records produce memory and disk charts at every history range", () => {
  const time = "2026-09-09T06:21:00Z";
  const record = { time, ram: 147067699, ram_total: 0, disk: 1299932160, disk_total: 0, swap: 0, swap_total: 0 };
  const totals = { memTotal: 486641664, diskTotal: 10731317760, swapTotal: 0 };
  for (const hours of [6, 12, 18, 24]) {
    const history = recordTransform.buildAllMetricHistories(hours, totals, [record], []);
    assert.equal(history.mem.hasData, true);
    assert.equal(history.disk.hasData, true);
    assert.equal(history.mem.values.at(-1), (record.ram / totals.memTotal) * 100);
    assert.equal(history.disk.values.at(-1), (record.disk / totals.diskTotal) * 100);
    assert.equal(history.swap.hasData, false);
    assert.equal(history.mem.timestamps.at(-1), Date.parse(time));
    assert.deepEqual(history.mem.timestamps, history.disk.timestamps);
  }
  const recent = recordTransform.buildAllMetricHistories(6, totals, [], [{
    updated_at: time, ram: { used: record.ram, total: 0 }, disk: { used: record.disk, total: 0 },
  }]);
  assert.equal(recent.mem.hasData, true);
  assert.equal(recent.disk.hasData, true);
});

test("recent fallback uses measured timestamps and leaves absent temperature empty", () => {
  const time = "2026-09-09T00:00:00Z";
  const history = recordTransform.buildAllMetricHistories(
    1,
    { memTotal: 100 },
    [],
    [{ updated_at: time, cpu: { usage: 3 } }],
  );
  assert.equal(history.cpu.values.at(-1), 3);
  assert.equal(history.cpu.timestamps.at(-1), Date.parse(time));
  assert.equal(history.temp.hasData, false);
});

test("one cancelled subscriber cannot abort another; last subscriber releases transport", async () => {
  queryCache.clearQueryCache();
  let release, sharedSignal;
  const loader = (signal) => {
    sharedSignal = signal;
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = queryCache.cachedQuery(
    "shared",
    loader,
    1000,
    firstController.signal,
  );
  const second = queryCache.cachedQuery(
    "shared",
    loader,
    1000,
    secondController.signal,
  );
  firstController.abort();
  await assert.rejects(first, (error) => error.name === "AbortError");
  assert.equal(sharedSignal.aborted, false);
  release(42);
  assert.equal(await second, 42);
  const last = new AbortController();
  const request = queryCache.cachedQuery("last", loader, 1000, last.signal);
  last.abort();
  await assert.rejects(request, (error) => error.name === "AbortError");
  assert.equal(sharedSignal.aborted, true);
  release(43);
});

test("large results return normally without retention", async () => {
  queryCache.clearQueryCache();
  let calls = 0;
  const loader = async () => {
    calls++;
    return "x".repeat(3 * 1024 * 1024);
  };
  assert.equal(
    (await queryCache.cachedQuery("large", loader, 1000)).length,
    3 * 1024 * 1024,
  );
  await queryCache.cachedQuery("large", loader, 1000);
  assert.equal(calls, 2);
});

test("cancelled batches stop before scheduling remaining nodes", async () => {
  const controller = new AbortController();
  const seen = [];
  await queue.mapWithConcurrency(
    [1, 2, 3, 4, 5],
    1,
    async (value) => {
      seen.push(value);
      controller.abort();
      return value;
    },
    controller.signal,
  );
  assert.deepEqual(seen, [1]);
});

test("history scheduler bounds concurrency across separate consumers", async () => {
  let active = 0,
    peak = 0;
  await Promise.all(
    Array.from({ length: 12 }, () =>
      queue.scheduleHistory(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return true;
      }, new AbortController().signal),
    ),
  );
  assert.equal(peak, 3);
});

test("ping lookup honors nearest ties, tolerance and gaps", () => {
  const points = [
    { t: 10, v: 1 },
    { t: 20, v: 2 },
    { t: 100, v: 3 },
  ];
  assert.equal(pingSeries.valueAtTime(points, 15), 1);
  assert.equal(pingSeries.valueAtTime(points, 90, 5), null);
  assert.equal(pingSeries.gapContainingTime(points, 30, 50)?.durationMs, 80);
  assert.equal(pingSeries.gapContainingTime(points, 30, 100), null);
  assert.equal(pingSeries.valueAtTime([], 10), null);
});

test("GPU history keeps extrema in 100000 records within the rendering budget", () => {
  const records = Array.from({ length: 100000 }, (_, i) => ({
    time: new Date(1_700_000_000_000 + i * 1000).toISOString(),
    utilization: i === 54321 ? 100 : 10,
    mem_used: i === 12345 ? 99 : 20,
    mem_total: 100,
  }));
  const sampled = gpuSampler.sampleGpuRecords(records);
  assert(sampled.length <= 1000);
  assert(sampled.includes(records[54321]));
  assert(sampled.includes(records[12345]));
  assert.strictEqual(sampled[0], records[0]);
  assert.strictEqual(sampled.at(-1), records.at(-1));
});

function hexLuminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hexContrast(first, second) {
  const a = hexLuminance(first);
  const b = hexLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("numeric helpers reject invalid telemetry and clamp percentages", () => {
  assert.equal(numeric.finiteNumber("12.5"), 12.5);
  assert.equal(numeric.finiteNumber(Number.POSITIVE_INFINITY, 7), 7);
  assert.equal(numeric.nonNegativeNumber(-9), 0);
  assert.equal(numeric.finiteNumber(-1), -1);
  assert.equal(numeric.safePercent(250, 100), 100);
  assert.equal(numeric.safePercent(10, 0), 0);
  assert.equal(numeric.timestampMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(
    numeric.timestampMs("2026-08-31T00:00:00.000Z"),
    Date.parse("2026-08-31T00:00:00.000Z"),
  );
  assert.equal(numeric.timestampMs("not-a-date"), null);
  assert.equal(numeric.timestampMs(0), null);
  assert.equal(numeric.timestampMs(null), null);
});

test("custom themes keep text readable across mixed light and dark surfaces", () => {
  for (const mode of ["light", "dark"]) {
    const defaults = colorScheme.resolveColorScheme({ presetId: "Kumo", mode });
    for (const key of [
      "--zen-fg",
      "--zen-fg-strong",
      "--zen-fg-muted",
      "--zen-fg-subtle",
      "--zen-fg-faint",
      "--zen-accent",
      "--zen-accent-muted",
      "--zen-success",
      "--zen-warning",
      "--zen-danger",
    ]) {
      assert.ok(hexContrast(defaults[key], defaults["--zen-bg"]) >= 4.48);
      assert.ok(hexContrast(defaults[key], defaults["--zen-surface"]) >= 4.48);
    }
    for (const key of [
      "--zen-chart-cpu",
      "--zen-chart-mem",
      "--zen-chart-swap",
      "--zen-chart-load",
      "--zen-chart-net-in",
      "--zen-chart-net-out",
      "--zen-chart-tcp",
      "--zen-chart-udp",
    ]) {
      assert.ok(hexContrast(defaults[key], defaults["--zen-bg"]) >= 2.98);
      assert.ok(hexContrast(defaults[key], defaults["--zen-surface"]) >= 2.98);
    }
  }

  const custom = colorScheme.resolveColorScheme({
    presetId: "Kumo",
    mode: "light",
    overrides: { bgLight: "#000000", surfaceLight: "#ffffff" },
  });
  for (const key of ["--zen-fg", "--zen-fg-strong"]) {
    assert.ok(hexContrast(custom[key], "#000000") >= 4.48);
    assert.ok(hexContrast(custom[key], "#ffffff") >= 4.48);
  }
  for (const key of ["--zen-chart-cpu", "--zen-chart-net-in"]) {
    assert.ok(hexContrast(custom[key], "#000000") >= 2.98);
    assert.ok(hexContrast(custom[key], "#ffffff") >= 2.98);
  }
});

test("Kumo keeps text and chart labels readable across its surface hierarchy", () => {
  assert.equal(colorScheme.normalizePresetId("Kumo"), "Kumo");
  assert.equal(colorSchemeSettings.colorSchemeFromTheme({ colorPreset: "Kumo" }).presetId, "Kumo");
  for (const mode of ["light", "dark"]) {
    const vars = colorScheme.resolveColorScheme({ presetId: "Kumo", mode });
    const surfaces = ["--zen-bg", "--zen-surface", "--zen-detail-bg", "--zen-card"];
    const text = [
      "--zen-fg", "--zen-fg-strong", "--zen-fg-muted", "--zen-fg-subtle", "--zen-fg-faint",
      "--zen-accent", "--zen-success", "--zen-warning", "--zen-danger", "--zen-chip-fg",
      "--zen-series-cpu", "--zen-series-mem", "--zen-series-disk", "--zen-series-swap",
      "--zen-series-net-in", "--zen-series-net-out", "--zen-latency-1", "--zen-latency-2", "--zen-latency-3",
    ];
    for (const key of text) {
      for (const surface of surfaces) {
        assert.ok(hexContrast(vars[key], vars[surface]) >= 4.48, `${mode} ${key} on ${surface}`);
      }
    }
    assert.ok(hexContrast(vars["--zen-online"], vars["--zen-online-bg"]) >= 4.48);
    assert.ok(hexContrast(vars["--zen-chip-fg"], vars["--zen-chip"]) >= 4.48);
    assert.notEqual(vars["--zen-accent"], vars["--zen-success"]);
  }
});

test("named palettes preserve Kumo and A\\ selections and expose all four choices", () => {
  const manifest = JSON.parse(readFileSync(new URL("../komari-theme.json", import.meta.url), "utf8"));
  const picker = manifest.configuration.data.find(field => field.key === "colorPreset");
  assert.deepEqual(picker.options.split(","), ["中性白", "柔暖色", "科技蓝", "薄荷绿"]);
  assert.equal(picker.default, "中性白");
  assert.equal(colorSchemeSettings.colorSchemeFromTheme({ colorPreset: "A\\" }).presetId, "Anthropic");
  assert.equal(colorSchemeSettings.colorSchemeFromTheme({}).presetId, "Kumo");
  for (const [label, id] of [["中性白", "Kumo"], ["柔暖色", "Anthropic"], ["科技蓝", "Carbon"], ["薄荷绿", "Supabase"], ["Kumo", "Kumo"], ["Anthropic", "Anthropic"]]) {
    assert.equal(colorSchemeSettings.colorSchemeFromTheme({ colorPreset: label }).presetId, id);
  }
});

test("four palettes keep text and chart values readable in both modes", () => {
  for (const presetId of Object.keys(colorPresets.COLOR_PRESETS)) {
  for (const mode of ["light", "dark"]) {
    const vars = colorScheme.resolveColorScheme({ presetId, mode });
    for (const key of ["--zen-fg", "--zen-fg-strong", "--zen-fg-muted", "--zen-fg-subtle", "--zen-fg-faint", "--zen-accent", "--zen-series-cpu", "--zen-series-mem", "--zen-series-disk", "--zen-series-swap", "--zen-series-net-in", "--zen-series-net-out"]) {
      for (const surface of ["--zen-bg", "--zen-surface", "--zen-detail-bg", "--zen-card"]) {
        assert.ok(hexContrast(vars[key], vars[surface]) >= 4.5, `${presetId} ${mode} ${key} on ${surface}`);
      }
    }
    assert.ok(hexContrast(vars["--zen-chip-fg"], vars["--zen-chip"]) >= 4.5);
    assert.ok(hexContrast(vars["--zen-online"], vars["--zen-online-bg"]) >= 4.5);
    assert.notEqual(vars["--zen-series-net-in"], vars["--zen-series-net-out"]);
    assert.notEqual(vars["--zen-success"], vars["--zen-accent"]);
    assert.notEqual(vars["--zen-bg"], vars["--zen-card"]);
  }
  }
});

test("Kumo custom surfaces reach detail cards and preserve status meaning", () => {
  const vars = colorScheme.resolveColorScheme({
    presetId: "Kumo", mode: "light",
    overrides: { bgLight: "#eeeeee", surfaceLight: "#f8f8f8", accentLight: "#7c3aed" },
  });
  assert.equal(vars["--zen-detail-bg"], "#eeeeee");
  assert.equal(vars["--zen-card"], "#f8f8f8");
  assert.notEqual(vars["--zen-success"], vars["--zen-accent"]);
  assert.ok(hexContrast(vars["--zen-fg-muted"], vars["--zen-card"]) >= 4.48);
});

test("switching from Kumo applies the destination detail palette without clearing font settings", () => {
  const previousDocument = globalThis.document;
  const styles = new Map([["--font-sans", "user-font"]]);
  globalThis.document = {
    documentElement: { style: {
      setProperty: (key, value) => styles.set(key, value),
      removeProperty: (key) => styles.delete(key),
    } },
  };
  try {
    colorSchemeApplication.applyColorScheme(colorScheme.resolveColorScheme({ presetId: "Kumo", mode: "light" }));
    assert.ok(styles.has("--zen-card"));
    colorSchemeApplication.applyColorScheme(colorScheme.resolveColorScheme({ presetId: "Anthropic", mode: "dark" }));
    assert.equal(styles.get("--zen-card"), "#26241f");
    assert.notEqual(styles.get("--zen-series-cpu"), "#4290f0");
    assert.equal(styles.get("--font-sans"), "user-font");
    assert.equal(styles.get("--zen-bg"), "#1c1b19");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("every palette covers detail pages and keeps custom accents separate from status colors", () => {
  for (const presetId of Object.keys(colorPresets.COLOR_PRESETS)) {
    for (const mode of ["light", "dark"]) {
      const base = colorScheme.resolveColorScheme({ presetId, mode });
      for (const key of ["--zen-detail-bg", "--zen-card", "--zen-chip", "--zen-chip-fg", "--zen-online-bg", "--zen-online", "--zen-series-cpu", "--zen-series-net-in"]) {
        assert.ok(base[key], `${presetId} ${mode} missing ${key}`);
      }
      const custom = colorScheme.resolveColorScheme({ presetId, mode, overrides: mode === "light"
        ? { bgLight: "#f4f4f4", surfaceLight: "#fafafa", accentLight: "#7030a0" }
        : { bgDark: "#101010", surfaceDark: "#202020", accentDark: "#ccaaff" } });
      assert.equal(custom["--zen-detail-bg"], custom["--zen-bg"]);
      assert.equal(custom["--zen-card"], custom["--zen-surface"]);
      assert.equal(custom["--zen-elevate"], custom["--zen-surface"]);
      assert.equal(custom["--zen-chip-fg"], custom["--zen-accent"]);
      assert.notEqual(custom["--zen-success"], custom["--zen-accent"]);
      assert.ok(hexContrast(custom["--zen-fg-muted"], custom["--zen-card"]) >= 4.48);
      assert.ok(hexContrast(custom["--zen-chip-fg"], custom["--zen-chip"]) >= 4.48);
      assert.ok(hexContrast(custom["--zen-online"], custom["--zen-online-bg"]) >= 4.48);
    }
  }
});

test("retired palette values fall back to Kumo and have no palette definitions", () => {
  assert.deepEqual(Object.keys(colorPresets.COLOR_PRESETS).sort(), ["Anthropic", "Carbon", "Kumo", "Supabase"]);
  for (const value of ["Warm", "Red", "Yellow", "Green", "Blue", "Purple", "Mono", "暖色", "红色", "黄色", "绿色", "蓝色", "紫色", "黑白"]) {
    assert.equal(colorSchemeSettings.colorSchemeFromTheme({ colorPreset: value }).presetId, "Kumo");
    for (const mode of ["light", "dark"]) {
      assert.deepEqual(colorScheme.resolveColorScheme({ presetId: value, mode }), colorScheme.resolveColorScheme({ presetId: "Kumo", mode }));
    }
  }
});

test("compact settings expose 18 controls while existing custom settings remain readable", () => {
  const manifest = JSON.parse(readFileSync(new URL("../komari-theme.json", import.meta.url), "utf8"));
  const fields = manifest.configuration.data;
  assert.equal(fields.filter(field => field.key).length, 18);
  assert.deepEqual(fields.filter(field => field.type === "title").map(field => field.name["zh-CN"]), ["通用", "延迟检测", "外观", "页脚"]);
  const legacy = {
    dashboardOverviewLayout: "经典布局 Classic", dashboardOverviewSections: "仅详细统计 Stats",
    dashboardCpuMetric: "最大值", dashboardBandwidthMetric: "最大值", dashboardNodeIds: '["old-node"]',
    defaultSortOrder: "降序", logoShape: "方形", showAutoRenewal: false,
    customBgLight: "#123456", customSurfaceDark: "#223344",
    fontPreset: "自定义", fontFamilyCustom: "Existing Font", fontCssUrlCustom: "https://example.invalid/font.css",
    latencyFixedGreenMax: 80, latencyFixedYellowMax: 160, latencyMeanGreenDelta: 7, latencyMeanYellowDelta: 25,
  };
  const parsed = themeSettings.parseThemeSettings({ ...legacy, showLatency: false, showExpiryTime: false });
  assert.equal(parsed.dashboardOverviewLayout, "Classic");
  assert.equal(parsed.dashboardOverviewSections, "Stats");
  assert.equal(parsed.dashboardCpuMetric, "Max");
  assert.equal(parsed.dashboardBandwidthMetric, "Max");
  assert.deepEqual(parsed.dashboardNodeIds, ["old-node"]);
  assert.equal(parsed.defaultSortOrder, "Descending");
  assert.equal(parsed.logoShape, "Square");
  assert.equal(parsed.showAutoRenewal, false);
  assert.equal(parsed.colorScheme.overrides.bgLight, "#123456");
  assert.equal(parsed.colorScheme.overrides.surfaceDark, "#223344");
  assert.equal(parsed.fontScheme.customFamily, "Existing Font");
  assert.equal(parsed.fontScheme.presetId, "Custom");
  assert.equal(parsed.fontScheme.customCssUrl, legacy.fontCssUrlCustom);
  assert.equal(parsed.latencyColorConfig.fixedGreenMax, 80);
  assert.equal(parsed.latencyColorConfig.fixedYellowMax, 160);
  assert.equal(parsed.latencyColorConfig.meanGreenDelta, 7);
  assert.equal(parsed.latencyColorConfig.meanYellowDelta, 25);
  assert.equal(parsed.showLatency, false);
  assert.equal(parsed.showExpiryTime, false);
  const fresh = themeSettings.parseThemeSettings({});
  assert.equal(fresh.dashboardOverviewLayout, "Panel");
  assert.equal(fresh.dashboardOverviewSections, "All");
  assert.equal(fresh.dashboardCpuMetric, "Average");
  assert.equal(fresh.dashboardBandwidthMetric, "Total");
  assert.equal(fresh.showAutoRenewal, true);
});

test("offline priority survives metric sorting and Keep allows the chosen order", () => {
  const nodes = [
    { id: "online-a", online: true, name: "A", cpuUsage: 20 },
    { id: "offline", online: false, name: "B", cpuUsage: 0 },
    { id: "online-c", online: true, name: "C", cpuUsage: 10 },
  ];
  for (const field of ["name", "cpu"]) {
    for (const direction of ["asc", "desc"]) {
      assert.equal(nodeSort.sortNodeList(nodes, field, direction, billingLabels, "First")[0].id, "offline");
      assert.equal(nodeSort.sortNodeList(nodes, field, direction, billingLabels, "Last").at(-1).id, "offline");
    }
  }
  assert.deepEqual(nodeSort.sortNodeList(nodes, "name", "asc", billingLabels, "Keep").map(node => node.id), ["online-a", "offline", "online-c"]);
});

test("footer links reject executable URL schemes", () => {
  assert.equal(sanitizeHtml.safeLinkHref("javascript:alert(1)"), null);
  assert.equal(sanitizeHtml.safeLinkHref("data:text/html,x"), null);
  assert.equal(
    sanitizeHtml.safeLinkHref("https://example.com/a"),
    "https://example.com/a",
  );
  assert.equal(sanitizeHtml.safeLinkHref("/status"), "/status");
});

test("dashboard trends drop records without a reasonable source timestamp", () => {
  assert.deepEqual(
    dashboardTrend.recentRecordsToDashboardTrend([
      {
        updated_at: 0,
        cpu: { usage: 42 },
        network: { down: 1, up: 2 },
      },
    ]),
    [],
  );
});

test("dashboard trends expire samples outside the recent three-minute window", () => {
  const endMs = Date.parse("2026-11-06T05:00:00Z");
  const histories = new Map([
    ["first", [
      { t: endMs - 181_000, cpu: 100, bandwidth: 900_000 },
      { t: endMs - 175_000, cpu: 10, bandwidth: 100 },
      { t: endMs - 85_000, cpu: 30, bandwidth: 300 },
    ]],
    ["second", [
      { t: endMs - 175_000, cpu: 20, bandwidth: 200 },
      { t: endMs - 85_000, cpu: 50, bandwidth: 500 },
    ]],
  ]);
  const current = new Map([
    ["first", { t: endMs, cpu: 60, bandwidth: 600 }],
    ["second", { t: endMs, cpu: 80, bandwidth: 800 }],
  ]);
  const series = dashboardTrend.aggregateDashboardTrends(histories, current, {
    cpuMetric: "Average", bandwidthMetric: "Total", endMs, bucketCount: 6,
  });
  assert.deepEqual(series.cpu, [15, null, null, 40, null, 70]);
  assert.deepEqual(series.bandwidth, [300, null, null, 800, null, 1400]);

  const maxima = dashboardTrend.aggregateDashboardTrends(histories, current, {
    cpuMetric: "Max", bandwidthMetric: "Max", endMs, bucketCount: 6,
  });
  assert.deepEqual(maxima.cpu, [20, null, null, 50, null, 80]);
  assert.deepEqual(maxima.bandwidth, [200, null, null, 500, null, 800]);
});

test("query keys are stable for objects with different property order", () => {
  const first = queryCache.queryCacheKey("records", {
    uuid: "node-1",
    range: { end: 2, start: 1 },
  });
  const second = queryCache.queryCacheKey("records", {
    range: { start: 1, end: 2 },
    uuid: "node-1",
  });
  assert.equal(first, second);
});

test("query cache deduplicates in-flight work and keeps successful results", async () => {
  queryCache.clearQueryCache();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const loader = async () => {
    calls += 1;
    await gate;
    return { value: 42 };
  };

  const first = queryCache.cachedQuery("dedupe", loader, 1_000);
  const second = queryCache.cachedQuery("dedupe", loader, 1_000);
  assert.equal(calls, 1);
  release();
  const [firstValue, secondValue] = await Promise.all([first, second]);
  assert.strictEqual(firstValue, secondValue);
  assert.strictEqual(
    await queryCache.cachedQuery("dedupe", loader, 1_000),
    firstValue,
  );
  assert.equal(calls, 1);
});

test("query cache does not retain failures or expired results", async () => {
  queryCache.clearQueryCache();
  let calls = 0;
  await assert.rejects(
    queryCache.cachedQuery(
      "retryable",
      async () => {
        calls += 1;
        throw new Error("temporary");
      },
      1_000,
    ),
    /temporary/,
  );
  assert.equal(
    await queryCache.cachedQuery(
      "retryable",
      async () => {
        calls += 1;
        return "recovered";
      },
      5,
    ),
    "recovered",
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(
    await queryCache.cachedQuery(
      "retryable",
      async () => {
        calls += 1;
        return "refreshed";
      },
      1_000,
    ),
    "refreshed",
  );
  assert.equal(calls, 3);
});

test("clearing the query cache prevents an older in-flight result from being cached", async () => {
  queryCache.clearQueryCache();
  let release;
  const oldRequest = queryCache.cachedQuery(
    "generation",
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    1_000,
  );
  queryCache.clearQueryCache();
  release("old");
  assert.equal(await oldRequest, "old");

  let freshCalls = 0;
  assert.equal(
    await queryCache.cachedQuery(
      "generation",
      async () => {
        freshCalls += 1;
        return "fresh";
      },
      1_000,
    ),
    "fresh",
  );
  assert.equal(freshCalls, 1);
});

test("single-pass metric histories match the established per-metric output", () => {
  const totals = { memTotal: 8_000, swapTotal: 2_000, diskTotal: 100_000 };
  const makeRecord = (time, offset) => ({
    client: "node-1",
    time,
    cpu: 20 + offset,
    ram: 2_000 + offset,
    ram_total: 8_000,
    swap: 200 + offset,
    swap_total: 2_000,
    load: 0.5 + offset,
    disk: 40_000 + offset,
    disk_total: 100_000,
    net_in: 1_000 + offset,
    net_out: 2_000 + offset,
    net_total_up: 0,
    net_total_down: 0,
    process: 80 + offset,
    connections: 30 + offset,
    connections_udp: 10 + offset,
    temp: 45 + offset,
  });
  const records = [
    makeRecord("2026-08-31T00:00:00.000Z", 0),
    makeRecord("2026-08-31T00:30:00.000Z", 1),
    makeRecord("2026-08-31T01:00:00.000Z", 2),
  ];
  const metrics = [
    "cpu",
    "load1",
    "mem",
    "swap",
    "disk",
    "netin",
    "netout",
    "tcp",
    "udp",
    "processes",
    "temp",
  ];
  const all = recordTransform.buildAllMetricHistories(1, totals, records, []);

  for (const metric of metrics) {
    assert.deepEqual(
      all[metric],
      recordTransform.buildMetricHistory(metric, 1, totals, records, []),
    );
  }
});

test("RPC batch results follow request order even when responses are reversed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const requests = JSON.parse(String(init.body));
    const responses = requests
      .filter((request) => request.id !== undefined)
      .map((request) => ({
        jsonrpc: "2.0",
        id: request.id,
        result: request.method,
      }))
      .reverse();
    return new Response(JSON.stringify(responses), {
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const client = new rpc2.RPC2Client("/api/rpc2", {
      autoConnect: false,
      enableHeartbeat: false,
    });
    assert.deepEqual(
      await client.batchCall([
        { method: "first" },
        { method: "notify", notification: true },
        { method: "second" },
      ]),
      ["first", "second"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RPC notification-only batches accept an empty 204 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    assert.deepEqual(
      await client.batchCall([
        { method: "first", notification: true },
        { method: "second", notification: true },
      ]),
      [],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RPC WebSocket abort removes the pending request", async () => {
  const OriginalWebSocket = globalThis.WebSocket;
  class FakeWebSocket {
    static OPEN = 1;
    readyState = 1;
    send() {}
  }
  globalThis.WebSocket = FakeWebSocket;
  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    client.connectionState = "connected";
    client.ws = new FakeWebSocket();
    const controller = new AbortController();
    const request = client.callViaWebSocket("slow", undefined, {
      signal: controller.signal,
      timeout: 1_000,
    });
    assert.equal(client.pendingRequests.size, 1);
    controller.abort();
    await assert.rejects(request, (error) => error?.name === "AbortError");
    assert.equal(client.pendingRequests.size, 0);
  } finally {
    globalThis.WebSocket = OriginalWebSocket;
  }
});

test("RPC WebSocket-to-HTTP fallback recovers a silent socket within one timeout budget", async () => {
  const originalFetch = globalThis.fetch;
  const OriginalWebSocket = globalThis.WebSocket;
  let fetchCalls = 0;
  class FakeWebSocket {
    static OPEN = 1;
    readyState = 1;
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = async (_url, options) => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: JSON.parse(options.body).id,
        result: true,
      }),
    );
  };
  try {
    const client = new rpc2.RPC2Client("/api/rpc2", {
      autoConnect: false,
      autoReconnect: false,
    });
    client.connectionState = "connected";
    client.ws = new FakeWebSocket();
    assert.equal(await client.call("slow", undefined, { timeout: 100 }), true);
    assert.equal(fetchCalls, 1);
    assert.equal(client.pendingRequests.size, 0);
    assert.equal(client.ws, null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = OriginalWebSocket;
  }
});

test("RPC HTTP surfaces JSON-RPC business errors without disguising them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32601, message: "missing method" },
      }),
      { headers: { "Content-Type": "application/json" } },
    );

  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    await assert.rejects(client.callViaHTTP("missing"), (error) => {
      assert.ok(error instanceof rpc2.RPC2ResponseError);
      assert.equal(error.code, -32601);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RPC HTTP rejects a response for a different request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 999, result: "wrong request" }),
      { headers: { "Content-Type": "application/json" } },
    );

  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    await assert.rejects(
      client.callViaHTTP("matched-id-only"),
      (error) => error instanceof rpc2.RPC2TransportError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unset expiry shows a price or a dash instead of the not-set label", () => {
  for (const expiredAt of ["", "0001-01-01T00:00:00Z", undefined]) {
    assert.equal(billingDisplay.isExpiryUnset(expiredAt), true);
    assert.equal(billingDisplay.resolveExpiryState(expiredAt).kind, "none");

    const priced = billingDisplay.formatNodeBilling(
      billingNode({ expiredAt, price: 7.79 }),
      billingLabels,
    );
    assert.equal(priced.text, "($7.79/月)");
    assert.equal(priced.expiryKind, "none");
    assert.equal(priced.text.includes(billingLabels.billingNotSet), false);

    const free = billingDisplay.formatNodeBilling(
      billingNode({ expiredAt, price: -1 }),
      billingLabels,
    );
    assert.equal(free.text, `(${billingLabels.billingFree})`);
    assert.equal(free.expiryKind, "none");

    const empty = billingDisplay.formatNodeBilling(
      billingNode({ expiredAt, price: 0 }),
      billingLabels,
    );
    assert.equal(empty.text, billingLabels.billingNoInfo);
    assert.equal(empty.expiryKind, "none");
    assert.equal(empty.daysRemaining, -1);
    assert.equal(empty.text.includes(billingLabels.billingNotSet), false);
  }

  const invalid = billingDisplay.formatNodeBilling(
    billingNode({ expiredAt: "not-a-date", price: 0 }),
    billingLabels,
  );
  assert.equal(billingDisplay.resolveExpiryState("not-a-date").kind, "none");
  assert.equal(invalid.text, billingLabels.billingNoInfo);
});

test("renewal badge stays hidden while expiry is unset", () => {
  const setAt = new Date(Date.now() + 10 * 86400000).toISOString();
  for (const expiredAt of ["", "   ", "0001-01-01T00:00:00Z", undefined]) {
    for (const autoRenewal of [false, true]) {
      assert.equal(
        billingDisplay.shouldShowAutoRenewalBadge({
          expiredAt,
          autoRenewal,
          showAutoRenewal: true,
          isLongTerm: false,
        }),
        false,
      );
    }
  }

  assert.equal(
    billingDisplay.shouldShowAutoRenewalBadge({
      expiredAt: setAt,
      autoRenewal: false,
      showAutoRenewal: true,
      isLongTerm: false,
    }),
    true,
  );
  assert.equal(
    billingDisplay.shouldShowAutoRenewalBadge({
      expiredAt: setAt,
      autoRenewal: true,
      showAutoRenewal: true,
      isLongTerm: false,
    }),
    true,
  );
  assert.equal(
    billingDisplay.shouldShowAutoRenewalBadge({
      expiredAt: setAt,
      autoRenewal: false,
      showAutoRenewal: false,
      isLongTerm: false,
    }),
    false,
  );
  assert.equal(
    billingDisplay.shouldShowAutoRenewalBadge({
      expiredAt: setAt,
      autoRenewal: undefined,
      showAutoRenewal: true,
      isLongTerm: false,
    }),
    false,
  );
  assert.equal(
    billingDisplay.shouldShowAutoRenewalBadge({
      expiredAt: setAt,
      autoRenewal: false,
      showAutoRenewal: true,
      isLongTerm: true,
    }),
    false,
  );
});

test("set expiry billing text stays days, expired, or long-term", () => {
  const activeAt = new Date(Date.now() + 10 * 86400000).toISOString();
  const active = billingDisplay.formatNodeBilling(
    billingNode({ expiredAt: activeAt, price: 7.79 }),
    billingLabels,
  );
  assert.equal(active.expiryKind, "active");
  assert.equal(active.isExpired, false);
  assert.equal(
    active.text,
    `${active.daysRemaining} ${billingLabels.unitDays} ($7.79/月)`,
  );
  assert.ok(active.daysRemaining >= 9 && active.daysRemaining <= 11);

  const urgent = billingDisplay.formatNodeBilling(
    billingNode({
      expiredAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      price: 7.79,
    }),
    billingLabels,
  );
  assert.equal(urgent.isUrgent, true);
  assert.equal(urgent.expiryKind, "active");

  const expired = billingDisplay.formatNodeBilling(
    billingNode({
      expiredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      price: 12,
    }),
    billingLabels,
  );
  assert.equal(expired.expiryKind, "expired");
  assert.equal(expired.isExpired, true);
  assert.equal(expired.daysRemaining, 0);
  assert.equal(expired.text, `0 ${billingLabels.unitDays} ($12/月)`);

  const longTerm = billingDisplay.formatNodeBilling(
    billingNode({
      expiredAt: new Date(Date.now() + 200 * 365 * 86400000).toISOString(),
      price: 9,
      billingCycle: 365,
    }),
    billingLabels,
  );
  assert.equal(longTerm.expiryKind, "long_term");
  assert.equal(longTerm.text, `${billingLabels.billingLongTerm} ($9/年)`);
  assert.equal(longTerm.isExpired, false);

  const hiddenPrice = billingDisplay.formatNodeBilling(
    billingNode({ expiredAt: activeAt, price: 0 }),
    billingLabels,
  );
  assert.equal(hiddenPrice.text, billingLabels.billingNoInfo);
  assert.equal(hiddenPrice.text.includes(billingLabels.billingNotSet), false);
  assert.equal(hiddenPrice.expiryKind, "none");
  assert.equal(hiddenPrice.daysRemaining, -1);
});

test("RPC HTTP timeout remains active while the response body is read", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const stream = new ReadableStream({
      start(controller) {
        init.signal.addEventListener(
          "abort",
          () => controller.error(init.signal.reason),
          { once: true },
        );
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    await assert.rejects(
      client.callViaHTTP("slow-body", undefined, { timeout: 15 }),
      (error) => error instanceof rpc2.RPC2TransportError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("detail history chips keep 6/12/18/24h and longer presets", () => {
  assert.deepEqual(timeRangePresets.detailHistoryHours(24, [6, 12, 18, 24]), [
    6, 12, 18, 24,
  ]);
  assert.deepEqual(timeRangePresets.detailHistoryHours(18, []), [6, 12, 18]);
  assert.deepEqual(
    timeRangePresets.detailHistoryHours(24 * 30, [24, 168, 720]),
    [6, 12, 18, 24, 168, 720],
  );
  assert.deepEqual(timeRangePresets.detailHistoryHours(3, []), [3]);
  assert.deepEqual(timeRangePresets.detailHistoryHours(0, [6]), []);
});
