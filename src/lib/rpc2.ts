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
      timeout?: ReturnType<typeof setTimeout>;
    }
  >();
  private reconnectAttempts = 0;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private eventListeners: RPC2EventListeners = {};

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

    this.setConnectionState(RPC2ConnectionState.CONNECTING);

    try {
      const ws = new WebSocket(this.getWebSocketUrl());
      this.ws = ws;
      this.setupWebSocketHandlers();

      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("WebSocket 连接失败"));
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("WebSocket 连接超时"));
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
      this.setConnectionState(RPC2ConnectionState.ERROR);
      this.eventListeners.onError?.(error as Error);
      throw error;
    }
  }

  private autoConnect(): void {
    if (this.connectionState !== RPC2ConnectionState.DISCONNECTED) return;

    this.connect().catch((error) => {
      console.warn("RPC2 自动连接失败:", error.message);
    });
  }

  disconnect(): void {
    this.options.autoReconnect = false;
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
      throw new Error("WebSocket 未连接");
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
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id!);
        reject(new Error(`请求超时: ${method}`));
      }, options.timeout || this.options.requestTimeout);

      this.pendingRequests.set(request.id!, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.sendMessage(request);
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

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.options.headers,
      body: JSON.stringify(request),
      signal: options.timeout
        ? AbortSignal.timeout(options.timeout)
        : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (options.notification) {
      return undefined as TResult;
    }

    const jsonResponse: JSONRPC2Response<TResult> = await response.json();
    if ("error" in jsonResponse) {
      throw new Error(
        `RPC Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`,
      );
    }

    return jsonResponse.result;
  }

  async batchCall(
    requests: Array<{
      method: string;
      params?: unknown;
      notification?: boolean;
    }>,
  ): Promise<unknown[]> {
    const batchRequest: JSONRPC2BatchRequest = requests.map((req) => ({
      jsonrpc: "2.0",
      method: req.method,
      params: req.params,
      id: req.notification ? undefined : this.generateRequestId(),
    }));

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.options.headers,
      body: JSON.stringify(batchRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const jsonResponse: JSONRPC2BatchResponse = await response.json();
    return jsonResponse.map((res) => {
      if ("error" in res) {
        throw new Error(`RPC Error ${res.error.code}: ${res.error.message}`);
      }
      return res.result;
    });
  }

  async call<TParams = unknown, TResult = unknown>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {},
  ): Promise<TResult> {
    if (
      this.options.autoConnect &&
      this.connectionState === RPC2ConnectionState.DISCONNECTED
    ) {
      this.autoConnect();
    }

    if (this.connectionState === RPC2ConnectionState.CONNECTED) {
      try {
        return await this.callViaWebSocket(method, params, options);
      } catch {
        return this.callViaHTTP(method, params, options);
      }
    }

    return this.callViaHTTP(method, params, options);
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${this.baseUrl}`;
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setConnectionState(RPC2ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.eventListeners.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
        this.eventListeners.onMessage?.(data);
      } catch (error) {
        console.error("解析 WebSocket 消息失败:", error);
      }
    };

    this.ws.onclose = () => {
      this.setConnectionState(RPC2ConnectionState.DISCONNECTED);
      this.stopHeartbeat();
      this.eventListeners.onDisconnect?.();

      if (
        this.options.autoReconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = () => {
      this.eventListeners.onError?.(new Error("WebSocket 连接错误"));
    };
  }

  private handleMessage(data: JSONRPC2Response): void {
    if (data.id === undefined || data.id === null) return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    this.pendingRequests.delete(data.id);
    if (pending.timeout) clearTimeout(pending.timeout);

    if ("error" in data) {
      pending.reject(
        new Error(`RPC Error ${data.error.code}: ${data.error.message}`),
      );
    } else {
      pending.resolve(data.result);
    }
  }

  private sendMessage(message: JSONRPC2Request): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket 未连接");
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
      if (pending.timeout) clearTimeout(pending.timeout);
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

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => undefined);
    }, this.options.reconnectInterval);
  }
}
