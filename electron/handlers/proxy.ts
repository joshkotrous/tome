import { ipcMain } from "electron";

ipcMain.handle("ai:proxy", async (event, { url, options }) => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
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

    // Process the stream with better error handling
    const processStream = async () => {
      if (!reader) return;

      try {
        let result = await reader.read();

        while (!result.done) {
          const chunk = decoder.decode(result.value, { stream: true });
          event.sender.send(`ai-stream-${streamId}`, {
            chunk,
            done: false,
          });

          result = await reader.read();
        }

        // Stream completed successfully
        event.sender.send(`ai-stream-${streamId}`, { done: true });
      } catch (streamError) {
        const errorMessage =
          streamError instanceof Error
            ? streamError.message
            : String(streamError);

        event.sender.send(`ai-stream-${streamId}`, {
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
      console.error("Unexpected error in processStream:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      event.sender.send(`ai-stream-${streamId}`, {
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
