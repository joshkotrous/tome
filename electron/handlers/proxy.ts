import { ipcMain } from "electron";

console.log("[Proxy Handler] Module loaded - registering ai:proxy handler");

ipcMain.handle("ai:proxy", async (event, { url, options }) => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  console.log("[Proxy Handler] Request to:", url);
  console.log("[Proxy Handler] Method:", options?.method);
  console.log("[Proxy Handler] Headers:", Object.keys(options?.headers || {}));

  try {
    const response = await fetch(url, options);

    console.log("[Proxy Handler] Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Proxy Handler] Error response:", errorBody);
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        error: errorBody,
      };
    }

    if (!response.body) {
      return {
        ok: false,
        status: 0,
        error: "Response body is null - streaming not supported",
      };
    }

    const streamId = Math.random().toString(36).substring(7);
    reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Helper to safely send to renderer
    const safeSend = (channel: string, data: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(channel, data);
      } else {
        console.warn("[Proxy Handler] Sender destroyed, cannot send to:", channel);
      }
    };

    // Process the stream with better error handling
    const processStream = async () => {
      if (!reader) return;

      console.log("[Proxy Handler] Starting to process stream:", streamId);
      let chunkCount = 0;

      try {
        let result = await reader.read();

        while (!result.done) {
          const chunk = decoder.decode(result.value, { stream: true });
          chunkCount++;
          safeSend(`ai-stream-${streamId}`, {
            chunk,
            done: false,
          });

          result = await reader.read();
        }

        console.log("[Proxy Handler] Stream completed. Total chunks:", chunkCount);
        // Stream completed successfully
        safeSend(`ai-stream-${streamId}`, { done: true });
      } catch (streamError) {
        const errorMessage =
          streamError instanceof Error
            ? streamError.message
            : String(streamError);

        console.error("[Proxy Handler] Stream error:", errorMessage);
        safeSend(`ai-stream-${streamId}`, {
          error: errorMessage,
          done: true,
        });
      } finally {
        if (reader) {
          try {
            reader.releaseLock();
          } catch (releaseError) {
            console.error("Error releasing reader lock:", releaseError);
          }
          reader = null;
        }
      }
    };

    // Start processing stream (don't await to return immediately)
    processStream().catch((error) => {
      console.error("[Proxy Handler] Unexpected error in processStream:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      safeSend(`ai-stream-${streamId}`, {
        error: errorMessage,
        done: true,
      });
    });

    return {
      ok: true,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      streamId,
    };
  } catch (error) {
    // Clean up reader if it was created
    if (reader) {
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.error(
          "Error releasing reader lock in catch block:",
          releaseError
        );
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      error: errorMessage,
    };
  }
});
