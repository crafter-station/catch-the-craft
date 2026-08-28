# syntax=docker/dockerfile:1.7

# Bun installs the locked dependencies; Node runs the build and the server.
#
# Bun's NAPI layer cannot load Turbopack's worker pool, so `bun run build` fails
# in a container even though it works locally — the same split the-next-craft
# arrived at. Node also runs the standalone server, which is the path Next tests.

# ── deps ──────────────────────────────────────────────────────────────────
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── builder ───────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ./node_modules/next/dist/bin/next build

# ── runner ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 -g nodejs nextjs

# public/ carries the beatmaps and sponsor logos, and the scores API reads
# manifest.json out of it at runtime, so it has to reach the final image.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The participant thumbnails are resized with sharp. Standalone tracing keeps
# sharp's JS and .node binding but drops @img/sharp-libvips-*, so the runtime
# dlopen fails without these — the same gap the-next-craft's image works around.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
