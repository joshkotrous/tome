/**
 * Creates a fetch proxy for AI providers in the main process.
 * Unlike the renderer proxy, this directly uses Node.js fetch since
 * the main process has full network access.
 */
export function createMainProcessAIProxy(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlString: string;
    let method: string = "GET";
    let headers: Record<string, string> = {};
    let body: BodyInit | undefined;

    if (input instanceof Request) {
      const clonedRequest = input.clone();
      urlString = clonedRequest.url;
      method = clonedRequest.method;
      clonedRequest.headers.forEach((value, key) => {
        headers[key] = value;
      });
      try {
        body = await clonedRequest.text();
      } catch {
        // Body might already be consumed or not available
      }
    } else {
      urlString = input.toString();
    }

    // Override with init values if provided
    if (init?.method) {
      method = init.method;
    }
    if (init?.headers) {
      const initHeaders = init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : Object.entries(init.headers as Record<string, string>).reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value.join(", ") : String(value);
            return acc;
          }, {} as Record<string, string>);
      headers = { ...headers, ...initHeaders };
    }
    if (init?.body !== undefined && init?.body !== null) {
      body = init.body;
    }

    console.log("[Main Process Proxy] Request to:", urlString, "Method:", method);

    // Use native fetch directly in the main process
    const response = await fetch(urlString, {
      method,
      headers,
      body,
    });

    return response;
  };
}
