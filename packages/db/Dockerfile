# Image for the "migrate" job: applies pending database migrations, then exits (src/migrate.ts).
# Build it from the REPO ROOT, like every service:
#   docker compose up migrate                                   (uses the root docker-compose.yml)
#   docker build -f packages/db/Dockerfile -t vmeet/migrate .   (same thing without compose)
#
# The database is only reachable inside the Docker network, so migrations run from a container
# on that network instead of from your machine.

# =========================================================================================
# Stage 1: prepare. Cut the monorepo down to the db package.
# =========================================================================================
# Same Node version as the api and local development.
FROM node:24.22.1-alpine AS prepare
WORKDIR /app

# turbo, at the same version as the repo's package.json.
RUN npm install --global turbo@2.11.11

COPY . .

# out/json = package.json files + trimmed lockfile; out/full = the db package's source,
# including the migration SQL folders in packages/db/drizzle.
RUN turbo prune db --docker

# =========================================================================================
# Stage 2: runner. Only what applying migrations needs.
# =========================================================================================
FROM node:24.22.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so this layer is reused until a package.json or the lockfile changes.
# --omit=dev leaves out drizzle-kit: the server only APPLIES migrations, it never generates
# them. Generating happens on a developer machine and the SQL is reviewed and committed.
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev && npm cache clean --force

# Source: src/migrate.ts and the drizzle/ migration folders.
COPY --from=prepare /app/out/full/ .

USER node
WORKDIR /app/packages/db

# Node 24 runs this TypeScript file directly (it strips the types), so no tsx or build step.
CMD ["node", "src/migrate.ts"]
