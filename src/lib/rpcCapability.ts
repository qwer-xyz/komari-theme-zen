const unsupportedMethods = new Set<string>();

export function canTryRpcMethod(method: string): boolean {
  return !unsupportedMethods.has(method);
}

export function noteRpcMethodFailure(method: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (/RPC Error -32601|method not found|unknown method/i.test(message)) {
    unsupportedMethods.add(method);
  }
}
