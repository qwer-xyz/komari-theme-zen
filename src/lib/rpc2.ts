import type {
  JSONRPC2Request,
  JSONRPC2Response,
  JSONRPC2BatchRequest,
  JSONRPC2BatchResponse,
  RPC2ConnectionStateType,
  RPC2ConnectionOptions,
  RPC2CallOptions,
  RPC2EventListeners,
} from "../types/rpc2";
import { RPC2ConnectionState } from "../types/rpc2";

export class RPC2TransportError extends Error {
  override readonly name = "RPC2TransportError";
}

export class RPC2ResponseError extends Error {
  override readonly name = "RPC2ResponseError";

  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(`RPC Error ${code}: ${message}`);
  }
}

function transportError(message: string, cause?: unknown): RPC2TransportError {
  const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : "";
  return new RPC2TransportError(`${message}${detail}`);
}

export class RPC2Client {
  private ws: WebSocket | null = null;
  private connectionState: RPC2ConnectionStateType =
    RPC2ConnectionState.DISCONNECTED;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      cleanup: () => void;
    }
  >();
  private reconnectAttempts = 0;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private eventListeners: RPC2EventListeners = {};
  private manuallyDisconnected = false;
  private reconnectCooldownUntil = 0;

  private readonly baseUrl: string;
  private readonly options: Required<RPC2ConnectionOptions>;

  constructor(baseUrl = "/api/rpc2", options: RPC2ConnectionOptions = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      autoConnect: true,
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      requestTimeout: 30000,
      enableHeartbeat: true,
      heartbeatInterval: 15000,
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    if (this.options.autoConnect) {
      this.autoConnect();
    }
  }

  get state(): RPC2ConnectionStateType {
    return this.connectionState;
  }

  setEventListeners(listeners: RPC2EventListeners): void {
    this.eventListeners = { ...this.eventListeners, ...listeners };
  }

  async connect(): Promise<void> {
    if (
      this.connectionState === RPC2ConnectionState.CONNECTED ||
      this.connectionState === RPC2ConnectionState.CONNECTING
    ) {
      return;
    }

    if (this.connectionState === RPC2ConnectionState.ERROR) {
      this.reconnectAttempts = 0;
    }

    this.manuallyDisconnected = false;
    this.setConnectionState(RPC2ConnectionState.CONNECTING);

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(this.getWebSocketUrl());
      this.ws = ws;
      this.setupWebSocketHandlers(ws);

      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new RPC2TransportError("WebSocket 连接失败"));
        };
        const timeout = setTimeout(() => {
          cleanup();
          if (this.ws === ws) this.ws = null;
          ws.close();
          reject(new RPC2TransportError("WebSocket 连接超时"));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
          ws.removeEventListener("open", handleOpen);
          ws.removeEventListener("error", handleError);
        };

        ws.addEventListener("open", handleOpen, { once: true });
        ws.addEventListener("error", handleError, { once: true });
      });
    } catch (error) {
      if (ws && this.ws === ws) {
        this.ws = null;
        ws.close();
      }
      this.setConnectionState(RPC2ConnectionState.ERROR);
      this.eventListeners.onError?.(error as Error);
      if (
        !this.manuallyDisconnected &&
        this.options.autoReconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.attemptReconnect();
      } else if (!this.manuallyDisconnected) {
        this.reconnectCooldownUntil = Date.now() + 60_000;
      }
      throw error;
    }
  }

  private autoConnect(): void {
    if (
      this.connectionState !== RPC2ConnectionState.DISCONNECTED &&
      this.connectionState !== RPC2ConnectionState.ERROR
    ) {
      return;
    }
    if (Date.now() < this.reconnectCooldownUntil) return;

    this.connect().catch((error) => {
      console.warn("RPC2 自动连接失败:", error.message);
    });
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.reconnectAttempts = 0;
    this.reconnectCooldownUntil = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState(RPC2ConnectionState.DISCONNECTED);
    this.clearPendingRequests(new Error("连接已断开"));
  }

  async callViaWebSocket<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {},
  ): Promise<TResult> {
    if (this.connectionState !== RPC2ConnectionState.CONNECTED) {
      throw new RPC2TransportError("WebSocket 未连接");
    }
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException("The operation was aborted", "AbortError");
    }

    const request: JSONRPC2Request<TParams> = {
      jsonrpc: "2.0",
      method,
      params,
      id: options.notification ? undefined : this.generateRequestId(),
    };

    if (options.notification) {
      this.sendMessage(request);
      return undefined as TResult;
    }

    return new Promise<TResult>((resolve, reject) => {
      const abortRequest = () => {
        this.pendingRequests.delete(request.id!);
        cleanup();
        reject(
          options.signal?.reason instanceof Error
            ? options.signal.reason
            : new DOMException("The operation was aborted", "AbortError"),
        );
      };
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id!);
        cleanup();
        reject(new RPC2TransportError(`请求超时: ${method}`));
      }, options.timeout ?? this.options.requestTimeout);
      const cleanup = () => {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortRequest);
      };

      this.pendingRequests.set(request.id!, {
        resolve: resolve as (value: unknown) => void,
        reject,
        cleanup,
      });
      options.signal?.addEventListener("abort", abortRequest, { once: true });

      try {
        this.sendMessage(request);
      } catch (error) {
        this.pendingRequests.delete(request.id!);
        cleanup();
        reject(
          error instanceof RPC2TransportError
            ? error
            : transportError("WebSocket 发送失败", error),
        );
      }
    });
  }

  async callViaHTTP<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {},
  ): Promise<TResult> {
    const request: JSONRPC2Request<TParams> = {
      jsonrpc: "2.0",
      method,
      params,
      id: options.notification ? undefined : this.generateRequestId(),
    };

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      options.timeout ?? this.options.requestTimeout,
    );

    try {
      let response: Response;
      try {
        response = await fetch(this.baseUrl, {
          method: "POST",
          headers: this.options.headers,
          body: JSON.stringify(request),
          signal: controller.signal,
        });
      } catch (error) {
        throw transportError(`HTTP 请求失败: ${method}`, error);
      }

      if (!response.ok) {
        throw new RPC2TransportError(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      if (options.notification) {
        return undefined as TResult;
      }

      let jsonResponse: JSONRPC2Response<TResult>;
      try {
        const parsed = (await response.json()) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Expected a JSON-RPC response object");
        }
        jsonResponse = parsed as JSONRPC2Response<TResult>;
      } catch (error) {
        throw transportError("RPC 响应不是有效 JSON", error);
      }
      if (
        jsonResponse.jsonrpc !== "2.0" ||
        jsonResponse.id !== request.id
      ) {
        throw new RPC2TransportError("RPC 响应 ID 或版本不匹配");
      }
      if ("error" in jsonResponse) {
        throw new RPC2ResponseError(
          jsonResponse.error.code,
          jsonResponse.error.message,
          jsonResponse.error.data,
        );
      }
      if (!("result" in jsonResponse)) {
        throw new RPC2TransportError("RPC 响应缺少 result");
      }

      return jsonResponse.result;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async batchCall(
    requests: Array<{
      method: string;
      params?: unknown;
      notification?: boolean;
    }>,
  ): Promise<unknown[]> {
    if (requests.length === 0) return [];
    const batchRequest: JSONRPC2BatchRequest = requests.map((req) => ({
      jsonrpc: "2.0",
      method: req.method,
      params: req.params,
      id: req.notification ? undefined : this.generateRequestId(),
    }));

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      this.options.requestTimeout,
    );
    try {
      let response: Response;
      try {
        response = await fetch(this.baseUrl, {
          method: "POST",
          headers: this.options.headers,
          body: JSON.stringify(batchRequest),
          signal: controller.signal,
        });
      } catch (error) {
        throw transportError("批量 RPC 请求失败", error);
      }

      if (!response.ok) {
        throw new RPC2TransportError(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const expectedResponses = batchRequest.filter(
        (request) => request.id !== undefined && request.id !== null,
      );
      if (expectedResponses.length === 0) return [];

      let jsonResponse: JSONRPC2BatchResponse;
      try {
        const parsed = (await response.json()) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("Expected a JSON-RPC batch response array");
        }
        jsonResponse = parsed.filter(
          (item): item is JSONRPC2Response =>
            Boolean(item) &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            (item as { jsonrpc?: unknown }).jsonrpc === "2.0",
        );
      } catch (error) {
        throw transportError("批量 RPC 响应不是有效 JSON", error);
      }
      const responsesById = new Map(
        jsonResponse
          .filter((res) => res.id !== undefined && res.id !== null)
          .map((res) => [res.id, res] as const),
      );
      return batchRequest.flatMap((request) => {
        if (request.id === undefined || request.id === null) return [];
        const res = responsesById.get(request.id);
        if (!res) throw new RPC2TransportError("批量 RPC 响应缺少请求结果");
        if ("error" in res) {
          throw new RPC2ResponseError(
            res.error.code,
            res.error.message,
            res.error.data,
          );
        }
        if (!("result" in res)) {
          throw new RPC2TransportError("批量 RPC 响应缺少 result");
        }
        return [res.result];
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async call<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {},
  ): Promise<TResult> {
    const timeoutBudget = options.timeout ?? this.options.requestTimeout;
    const deadline = Date.now() + Math.max(0, timeoutBudget);
    if (
      this.options.autoConnect &&
      (this.connectionState === RPC2ConnectionState.DISCONNECTED ||
        this.connectionState === RPC2ConnectionState.ERROR)
    ) {
      this.autoConnect();
    }

    if (this.connectionState === RPC2ConnectionState.CONNECTED) {
      try {
        return await this.callViaWebSocket(method, params, {
          ...options,
          timeout: timeoutBudget,
        });
      } catch (error) {
        if (error instanceof RPC2ResponseError) throw error;
        if (this.manuallyDisconnected || options.signal?.aborted) throw error;
        if (!(error instanceof RPC2TransportError)) throw error;
        if (options.allowHttpFallback === false) throw error;
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw error;
        return this.callViaHTTP(method, params, {
          ...options,
          timeout: remaining,
        });
      }
    }

    return this.callViaHTTP(method, params, {
      ...options,
      timeout: timeoutBudget,
    });
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${this.baseUrl}`;
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.setConnectionState(RPC2ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.reconnectCooldownUntil = 0;
      this.startHeartbeat();
      this.eventListeners.onConnect?.();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
        this.eventListeners.onMessage?.(data);
      } catch (error) {
        console.error("解析 WebSocket 消息失败:", error);
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.setConnectionState(RPC2ConnectionState.DISCONNECTED);
      this.stopHeartbeat();
      this.clearPendingRequests(
        new RPC2TransportError("WebSocket 连接已断开"),
      );
      this.eventListeners.onDisconnect?.();

      if (
        !this.manuallyDisconnected &&
        this.options.autoReconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.attemptReconnect();
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.eventListeners.onError?.(new Error("WebSocket 连接错误"));
    };
  }

  private handleMessage(data: JSONRPC2Response): void {
    if (data.id === undefined || data.id === null) return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    this.pendingRequests.delete(data.id);
    pending.cleanup();

    if ("error" in data) {
      pending.reject(
        new RPC2ResponseError(
          data.error.code,
          data.error.message,
          data.error.data,
        ),
      );
    } else {
      pending.resolve(data.result);
    }
  }

  private sendMessage(message: JSONRPC2Request): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new RPC2TransportError("WebSocket 未连接");
    }
    this.ws.send(JSON.stringify(message));
  }

  private setConnectionState(state: RPC2ConnectionStateType): void {
    this.connectionState = state;
  }

  private generateRequestId(): number {
    return ++this.requestId;
  }

  private clearPendingRequests(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.cleanup();
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private startHeartbeat(): void {
    if (!this.options.enableHeartbeat) return;
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              method: "rpc.ping",
              params: { timestamp: Date.now() },
            }),
          );
        } catch (error) {
          console.warn("发送心跳包失败:", error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    this.setConnectionState(RPC2ConnectionState.RECONNECTING);
    this.eventListeners.onReconnecting?.(this.reconnectAttempts);

    const exponentialDelay = Math.min(
      30_000,
      this.options.reconnectInterval * 2 ** Math.max(0, this.reconnectAttempts - 1),
    );
    const jitteredDelay = Math.round(exponentialDelay * (0.8 + Math.random() * 0.4));
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => undefined);
    }, jitteredDelay);
  }
}
