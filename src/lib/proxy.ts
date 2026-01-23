export function createAIProviderProxy(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Handle Request objects by extracting all relevant data
    let urlString: string;
    let method: string = "GET";
    let headers: Record<string, string> = {};
    let body: string | undefined;

    if (input instanceof Request) {
      // Clone the request to avoid consuming its body
      const clonedRequest = input.clone();
      urlString = clonedRequest.url;
      method = clonedRequest.method;
      // Extract headers from Request
      clonedRequest.headers.forEach((value, key) => {
        headers[key] = value;
      });
      // Get body from Request if it exists
      try {
        body = await clonedRequest.text();
      } catch {
        // Body might already be consumed or not available
        console.log("[Proxy] Could not read body from Request");
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
        : Object.entries(init.headers).reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value.join(", ") : String(value);
            return acc;
          }, {} as Record<string, string>);
      headers = { ...headers, ...initHeaders };
    }
    if (init?.body !== undefined) {
      body = typeof init.body === "string" ? init.body : String(init.body);
    }

    const needsProxy =
      urlString.includes("api.anthropic.com") ||
      urlString.includes("api.openai.com");

    if (!needsProxy) {
      return fetch(input, init);
    }

    console.log("[Proxy] Routing request to:", urlString, "Method:", method);
    console.log("[Proxy] window.proxy exists:", !!window.proxy);
    console.log("[Proxy] window.proxy.fetchStream exists:", !!(window.proxy?.fetchStream));

    if (!window.proxy?.fetchStream) {
      throw new Error("window.proxy.fetchStream is not available - proxy bridge not loaded");
    }

    let result;
    try {
      console.log("[Proxy] Calling window.proxy.fetchStream...");
      result = await window.proxy.fetchStream(urlString, {
        method,
        headers,
        body,
      });
      console.log("[Proxy] fetchStream returned:", result);
    } catch (invokeError) {
      console.error("[Proxy] fetchStream invoke failed:", invokeError);
      throw invokeError;
    }

    if (!result.ok) {
      const errorDetail = (result as any).error || result.statusText || "Unknown error";
      console.error("[Proxy] Request failed:", result.status, errorDetail);
      throw new Error(`HTTP ${result.status}: ${errorDetail}`);
    }

    if (!result.streamId) {
      throw new Error("No stream ID returned from proxy");
    }

    console.log("[Proxy] Got stream ID:", result.streamId, "Status:", result.status);

    // Create a ReadableStream that reads from the IPC stream
    const streamId = result.streamId;
    const channel = `ai-stream-${streamId}`;
    
    const stream = new ReadableStream({
      start(controller) {
        console.log("[Proxy] Starting stream listener for:", streamId);
        
        const listener = (_event: unknown, data: { chunk?: string; done: boolean; error?: string }) => {
          if (data.error) {
            console.error("[Proxy] Stream error:", data.error);
            controller.error(new Error(data.error));
            window.ipcRenderer.off(channel, listener);
            return;
          }

          if (data.done) {
            console.log("[Proxy] Stream completed");
            controller.close();
            window.ipcRenderer.off(channel, listener);
            return;
          }

          if (data.chunk) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(data.chunk));
          }
        };
        
        window.ipcRenderer.on(channel, listener);
      },
    });

    return new Response(stream, {
      status: result.status,
      headers: new Headers(result.headers || {}),
    });
  };
}
