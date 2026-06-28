export type ApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T & { error?: string };
};

const SESSION_EXPIRED = "Session expired — reload the page to sign in again.";

export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Catch the Cloudflare Access redirect to its login page: an expired
      // session bounces the request cross-origin, which surfaces here as an
      // opaque redirect instead of a readable response.
      redirect: "manual",
    });
    if (response.type === "opaqueredirect" || response.status === 0) {
      return {
        ok: false,
        status: 0,
        data: { error: SESSION_EXPIRED } as T & { error?: string },
      };
    }
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    return { ok: response.ok, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Could not reach the server." } as T & { error?: string },
    };
  }
}
