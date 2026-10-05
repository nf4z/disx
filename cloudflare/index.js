import { DurableObject } from "cloudflare:workers";

const PORT = 3001;
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const START_TIMEOUT_MS = 300_000;

export class DisxContainer extends DurableObject {
  starting = null;

  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;

    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() =>
        ctx.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
      );
    }
  }

  observeContainer() {
    if (!this.ctx.container?.running) return;
    this.ctx.waitUntil(
      this.ctx.container.monitor().catch((error) => {
        console.error("[container] exited with error:", error);
      }),
    );
  }

  async ensureStarted() {
    if (this.starting) return this.starting;

    this.starting = (async () => {
      const container = this.ctx.container;

      if (!container) {
        throw new Error("Cloudflare Container binding is not configured");
      }

      // Durable Object-managed containers do not participate in automatic
      // application-wide rollouts. Replace a running instance when Wrangler
      // gives this Worker a newer digest-pinned image.
      if (container.running) {
        const desiredImage = String(container.images.base);
        const current = await container.inspect();
        if (current?.image && current.image !== desiredImage) {
          console.log("[container] replacing stale image", current.image, "with", desiredImage);
          await container.destroy("Replacing stale image after deployment");
        }
      }

      if (!container.running) {
        // DATABASE is the actual connection string consumed by the Node.js
        // process inside the Container. DATABASE_URL is accepted as an alias.
        const database = this.env.DATABASE ?? this.env.DATABASE_URL;

        const envVars = {
          NODE_ENV: "production",
          PORT: String(PORT),
          CONFIG_PATH: "/data/state/config.json",
          STORAGE_LOCATION: "/data/storage",
          ...(database ? { DATABASE: String(database) } : {}),
          ...Object.fromEntries(
            [
              "DOMAIN",
              "APPLY_DB_MIGRATIONS",
              "DB_SYNC",
              "DB_POOL_SIZE",
              "INSTANCE_NAME",
              "TRUSTED_PROXIES",
              "WRTC_PUBLIC_IP",
              "WRTC_PORT",
              "WRTC_PORT_MIN",
              "WRTC_PORT_MAX",
              "WRTC_LIBRARY",
              "CAP_INSTANCE_URL",
              "CAP_SITE_KEY",
              "CAP_SECRET_KEY",
              "SMTP_HOST",
              "SMTP_PORT",
              "SMTP_SECURE",
              "SMTP_STARTTLS",
              "SMTP_USERNAME",
              "SMTP_PASSWORD",
              "EMAIL_FROM",
              "CLIENT_CONCURRENCY",
              "LOG_REQUESTS",
              "E2EE_RECOVERY_KEY_FILE",
              "E2EE_RECOVERY_MASTER_KEY",
            ]
              .filter((name) => this.env[name] !== undefined)
              .map((name) => [name, String(this.env[name])]),
          ),
        };

        if (!envVars.DOMAIN) {
          throw new Error("Cloudflare secret/variable DOMAIN is required");
        }

        if (!envVars.DATABASE) {
          throw new Error(
            "No PostgreSQL database is configured. Provide the DATABASE or DATABASE_URL Cloudflare secret.",
          );
        }

        container.start({
          image: container.images.base,
          instance: "standard-1",
          enableInternet: true,
          env: envVars,
        });
        this.observeContainer();
      } else {
        this.observeContainer();
      }

      await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

      const port = container.getTcpPort(PORT);
      const deadline = Date.now() + START_TIMEOUT_MS;
      let lastError;

      while (Date.now() < deadline) {
        try {
          const response = await port.fetch("http://container/api/readyz", {
            signal: AbortSignal.timeout(1500),
          });

          await response.body?.cancel();
          if (!response.ok) {
            throw new Error(`container health check returned HTTP ${response.status}`);
          }
          return;
        } catch (error) {
          lastError = error;
          await scheduler.wait(500);
        }
      }

      console.error("[container] readiness timeout:", lastError);
      try {
        await container.destroy();
      } catch (error) {
        console.error("[container] failed to destroy unhealthy instance:", error);
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
    try {
      await this.ensureStarted();
    } catch (error) {
      console.error("[container] startup failed:", error);
      return new Response("Disx container failed to start. Check Cloudflare Worker logs for the container startup error.", { status: 503 });
    }

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
