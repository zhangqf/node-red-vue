export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("HTTP timeout must be a positive finite number");
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signals = [timeoutSignal];

  if (init.signal) signals.push(init.signal);
  if (input instanceof Request) signals.push(input.signal);

  return globalThis.fetch(input, {
    ...init,
    signal: AbortSignal.any(signals),
  });
}
