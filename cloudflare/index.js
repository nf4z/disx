import { DurableObject } from "cloudflare:workers";

const PORT = 3001;
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const START_TIMEOUT_MS = 60_000;

export class DisxContainer extends DurableObject {
  starting = null;

  constructor(ctx, env) {
    super(ctx, env);

    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() =>
        ctx.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
      );
    }
  }

  async ensureStarted() {
    if (this.starting) return this.starting;

    this.starting = (async () => {
      const container = this.ctx.container;

      if (!container) {
        throw new Error("Cloudflare Container binding is not configured");
      }

      if (!container.running) {
        container.start({
          image: container.images.base,
          instance: "basic",
          enableInternet: true,
        });
      }

      await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

      const port = container.getTcpPort(PORT);
      const deadline = Date.now() + START_TIMEOUT_MS;
      let lastError;

      while (Date.now() < deadline) {
        try {
          const response = await port.fetch("http://container/", {
            signal: AbortSignal.timeout(1500),
          });

          await response.body?.cancel();
          return;
        } catch (error) {
          lastError = error;
          await scheduler.wait(500);
        }
      }

      throw new Error("disx container did not become ready", {
        cause: lastError,
      });
    })().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  async fetch(request) {
    await this.ensureStarted();

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";

    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");

    return this.ctx.container.getTcpPort(PORT).fetch(forwarded);
  }
}

export default {
  async fetch(request, env) {
    const container = env.DISX_CONTAINER.getByName("main");
    return container.fetch(request);
  },
};
