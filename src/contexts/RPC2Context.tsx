import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { RPC2Client } from "../lib/rpc2";
import type { RPC2ConnectionStateType } from "../types/rpc2";

interface RPC2ContextType {
  client: RPC2Client;
  connectionState: RPC2ConnectionStateType;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const RPC2Context = createContext<RPC2ContextType | undefined>(undefined);

let rpc2Singleton: RPC2Client | null = null;
let rpc2RefCount = 0;

export const RPC2Provider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [client] = useState(() => {
    if (!rpc2Singleton) {
      rpc2Singleton = new RPC2Client("/api/rpc2", { autoConnect: true });
    }
    return rpc2Singleton;
  });
  const [connectionState, setConnectionState] = useState(client.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc2RefCount++;

    client.setEventListeners({
      onConnect: () => {
        setConnectionState(client.state);
        setError(null);
      },
      onDisconnect: () => setConnectionState(client.state),
      onError: (err) => {
        setError(err.message);
        setConnectionState(client.state);
      },
      onReconnecting: () => setConnectionState(client.state),
    });

    return () => {
      rpc2RefCount = Math.max(0, rpc2RefCount - 1);
      if (rpc2RefCount === 0) {
        client.disconnect();
      }
    };
  }, [client]);

  const connect = async () => {
    setError(null);
    await client.connect();
  };

  return (
    <RPC2Context.Provider
      value={{
        client,
        connectionState,
        isConnected: connectionState === "connected",
        error,
        connect,
        disconnect: () => client.disconnect(),
      }}
    >
      {children}
    </RPC2Context.Provider>
  );
};

export const useRPC2 = (): RPC2ContextType => {
  const context = useContext(RPC2Context);
  if (!context) {
    throw new Error("useRPC2 必须在 RPC2Provider 内使用");
  }
  return context;
};

export const useRPC2Call = () => {
  const { client, isConnected } = useRPC2();

  const call = useCallback(
    <TParams = unknown, TResult = unknown>(
      method: string,
      params?: TParams,
      options?: Parameters<RPC2Client["call"]>[2],
    ) => client.call<TParams, TResult>(method, params, options),
    [client],
  );

  return { call, isConnected };
};
