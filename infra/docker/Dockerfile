FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./

FROM base AS deps
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY tsconfig.base.json tsconfig.json vitest.workspace.ts .eslintrc.cjs ./
RUN pnpm build

FROM node:20-alpine AS production
RUN apk add --no-cache curl tini
RUN addgroup --system --gid 1001 preflight && \
    adduser --system --uid 1001 preflight

WORKDIR /app

COPY --from=deps --chown=preflight:preflight /app/node_modules ./node_modules
COPY --from=build --chown=preflight:preflight /app/packages ./packages
COPY --from=build --chown=preflight:preflight /app/apps ./apps
COPY --from=build --chown=preflight:preflight /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000

USER preflight

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

STOPSIGNAL SIGTERM

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
