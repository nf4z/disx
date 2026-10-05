import { DurableObject } from "cloudflare:workers";

const PORT = 3001;
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const START_TIMEOUT_MS = 180_000;

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
    const container = this.ctx.container;
    if (!container?.running) return;

    this.ctx.waitUntil(
      container.monitor()
        .then(() => {
          console.error("[container] exited normally while being monitored");
        })
        .catch((error) => {
          console.error("[container] exited unexpectedly", {
            exitCode: error?.exitCode ?? null,
            reason: error instanceof Error ? error.message : String(error),
          });
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
          DISX_DISABLE_WEBRTC: "1",
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
          // One full vCPU keeps Node/TypeORM startup responsive while retaining
          // the same 4 GiB RAM and 8 GB disk as standard-1.
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

      let polls = 0;
      while (Date.now() < deadline) {
        polls++;
        if (!container.running) {
          throw new Error("container stopped while waiting for readiness");
        }

        try {
          const response = await port.fetch("http://container/api/ping", {
            signal: AbortSignal.timeout(2000),
          });

          await response.body?.cancel();
          if (response.ok) {
            console.log("[container] ready", {
              startupMs: Date.now() - (deadline - START_TIMEOUT_MS),
              polls,
            });
            return;
          }

          lastError = new Error(`container health check returned HTTP ${response.status}`);
        } catch (error) {
          lastError = error;
        }

        if (polls % 10 === 0) {
          console.log("[container] still starting", {
            elapsedMs: Date.now() - (deadline - START_TIMEOUT_MS),
            running: container.running,
            lastError: lastError instanceof Error ? lastError.message : String(lastError),
          });
        }
        await scheduler.wait(1000);
      }

      const details = lastError instanceof Error ? lastError.message : String(lastError);
      const state = await container.inspect().catch(() => null);
      console.error("[container] readiness timeout", {
        elapsedMs: START_TIMEOUT_MS,
        running: container.running,
        state,
        lastError: details,
      });
      // Do not destroy a slow container here. Long DB migrations and cold starts
      // can finish after the readiness window; destroying it would create a
      // permanent cold-start/restart loop.
      throw new Error(\`disx container did not become ready after \${START_TIMEOUT_MS}ms: \${details}\`);
    })().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  async fetch(request) {
    try {
      await this.ensureStarted();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
      console.error("[container] startup failed:", { message, cause });
      return new Response(
        \`Disx container is still starting or failed to become ready. \${message}\`,
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } },
      );
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
