export function createAIProviderProxy() {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const urlString = url.toString();

    const needsProxy =
      urlString.includes("api.anthropic.com") ||
      urlString.includes("api.openai.com");

    if (!needsProxy) {
      return fetch(url, init);
    }

    const result = await window.proxy.fetchStream(urlString, {
      method: init?.method || "GET",
      headers: init?.headers
        ? Object.fromEntries(
            init.headers instanceof Headers
              ? init.headers.entries()
              : Object.entries(init.headers)
          )
        : {},
      body: init?.body ? String(init.body) : undefined,
    });

    if (!result.ok) {
      throw new Error(`HTTP ${result.status}: ${result.statusText || ""}`);
    }

    if (!result.streamId) {
      throw new Error("No stream ID returned from proxy");
    }

    // Create a ReadableStream that reads from the IPC stream
    const stream = new ReadableStream({
      start(controller) {
        const cleanup = window.proxy.onStreamData(result.streamId!, (data) => {
          if (data.error) {
            controller.error(new Error(data.error));
            cleanup();
            return;
          }

          if (data.done) {
            controller.close();
            cleanup();
            return;
          }

          if (data.chunk) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(data.chunk));
          }
        });
      },
    });

    return new Response(stream, {
      status: result.status,
      headers: new Headers(result.headers || {}),
    });
  };
}
