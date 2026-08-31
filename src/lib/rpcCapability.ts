const unsupportedMethods = new Set<string>();

export function canTryRpcMethod(method: string): boolean {
  return !unsupportedMethods.has(method);
}

export function isRpcMethodUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /RPC Error -32601|method not found|unknown method/i.test(message);
}

export function noteRpcMethodFailure(method: string, error: unknown): boolean {
  const unsupported = isRpcMethodUnsupported(error);
  if (unsupported) {
    unsupportedMethods.add(method);
  }
  return unsupported;
}
