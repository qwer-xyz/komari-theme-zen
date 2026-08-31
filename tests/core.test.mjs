import assert from "node:assert/strict";
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
const recordTransform = await vite.ssrLoadModule(
  "/src/lib/recordTransform.ts",
);
const rpc2 = await vite.ssrLoadModule("/src/lib/rpc2.ts");
const colorScheme = await vite.ssrLoadModule(
  "/src/lib/colorScheme/resolveScheme.ts",
);
const sanitizeHtml = await vite.ssrLoadModule("/src/lib/sanitizeHtml.ts");
const dashboardTrend = await vite.ssrLoadModule("/src/lib/dashboardTrend.ts");

function hexLuminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
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
  const defaults = colorScheme.resolveColorScheme({
    presetId: "Warm",
    mode: "light",
  });
  assert.equal(defaults["--zen-fg-subtle"], "#5f5f58");
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
    assert.ok(hexContrast(defaults[key], "#dad8ca") >= 4.48);
    assert.ok(hexContrast(defaults[key], "#e7e5da") >= 4.48);
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
    assert.ok(hexContrast(defaults[key], "#dad8ca") >= 2.98);
    assert.ok(hexContrast(defaults[key], "#e7e5da") >= 2.98);
  }

  const custom = colorScheme.resolveColorScheme({
    presetId: "Warm",
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

test("footer links reject executable URL schemes", () => {
  assert.equal(sanitizeHtml.safeLinkHref("javascript:alert(1)"), null);
  assert.equal(sanitizeHtml.safeLinkHref("data:text/html,x"), null);
  assert.equal(sanitizeHtml.safeLinkHref("https://example.com/a"), "https://example.com/a");
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
  const all = recordTransform.buildAllMetricHistories(
    1,
    totals,
    records,
    [],
  );

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

test("RPC WebSocket-to-HTTP fallback shares one timeout budget", async () => {
  const originalFetch = globalThis.fetch;
  const OriginalWebSocket = globalThis.WebSocket;
  let fetchCalls = 0;
  class FakeWebSocket {
    static OPEN = 1;
    readyState = 1;
    send() {}
  }
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: true }));
  };
  try {
    const client = new rpc2.RPC2Client("/api/rpc2", { autoConnect: false });
    client.connectionState = "connected";
    client.ws = new FakeWebSocket();
    await assert.rejects(
      client.call("slow", undefined, { timeout: 15 }),
      (error) => error instanceof rpc2.RPC2TransportError,
    );
    assert.equal(fetchCalls, 0);
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
