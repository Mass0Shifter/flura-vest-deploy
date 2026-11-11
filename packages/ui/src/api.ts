// Browser API client. Calls go to same-origin /api/*, which each app rewrites to the API service,
// so session cookies stay first-party and httpOnly.

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", "x-fv-client": "1", ...init.headers },
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; fields?: Record<string, string> } }).error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? "Something went wrong", e?.fields);
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

export function idempotencyKey() {
  return crypto.randomUUID();
}
