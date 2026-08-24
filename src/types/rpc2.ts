export interface JSONRPC2Request<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
  id?: string | number | null;
}

export interface JSONRPC2SuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  result: T;
  id: string | number | null;
}

export interface JSONRPC2Error {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPC2ErrorResponse {
  jsonrpc: "2.0";
  error: JSONRPC2Error;
  id: string | number | null;
}

export type JSONRPC2Response<T = unknown> =
  | JSONRPC2SuccessResponse<T>
  | JSONRPC2ErrorResponse;

export type JSONRPC2BatchRequest = JSONRPC2Request[];
export type JSONRPC2BatchResponse = JSONRPC2Response[];

export const RPC2ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
} as const;

export type RPC2ConnectionStateType =
  (typeof RPC2ConnectionState)[keyof typeof RPC2ConnectionState];

export interface RPC2ConnectionOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  requestTimeout?: number;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
}

export interface RPC2CallOptions {
  timeout?: number;
  notification?: boolean;
}

export interface RPC2EventListeners {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
  onMessage?: (data: unknown) => void;
}
