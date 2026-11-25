# Image for the api. Build it from the REPO ROOT, because the api imports packages/db and
# packages/types, and Docker can only copy files inside the build context:
#   docker compose up -d --build api                         (uses the root docker-compose.yml)
#   docker build -f apps/api/Dockerfile -t convosphere/api .       (same thing without compose)

# =========================================================================================
# Stage 1: prepare. Cut the monorepo down to what the api needs.
# =========================================================================================
# Exact Node version, the same one used for development, so builds don't change by surprise.
# Alpine keeps the image small; bcrypt ships a ready-made Alpine build, so no compiler is needed.
FROM node:24.22.1-alpine AS prepare
WORKDIR /app

# turbo, at the same version as the repo's package.json.
RUN npm install --global turbo@2.11.11

# The whole repo (minus what .dockerignore excludes: node_modules, .env files, .git ...).
COPY . .

# Writes /app/out with only the api, the workspace packages it imports (db, types) and a
# lockfile trimmed to their dependencies. Other apps (room-service ...) are left out, so
# changing them never rebuilds this image. Files ignored by Git (.env) are not copied.
#   out/json = only the package.json files + package-lock.json  (enough to install)
#   out/full = the full source code
RUN turbo prune api --docker

# =========================================================================================
# Stage 2: runner. The final image: production dependencies + source, nothing else.
# Nothing from stage 1 (turbo, the full repo) ends up in it except the files copied below.
# =========================================================================================
FROM node:24.22.1-alpine AS runner
WORKDIR /app

# Tells libraries (Express ...) to run in production mode.
ENV NODE_ENV=production

# 1) Dependencies first. Docker reuses this layer as long as no package.json and no lockfile
#    changed, so a code-only change rebuilds in seconds instead of re-running npm ci.
COPY --from=prepare /app/out/json/ .
# ci = install exactly what the lockfile says. --omit=dev skips typescript, @types/*, turbo,
# prettier. tsx is a normal dependency of the api because it runs the TypeScript at runtime.
RUN npm ci --omit=dev && npm cache clean --force

# 2) Then the source code (changes most often, so it comes last).
COPY --from=prepare /app/out/full/ .

# Don't run as root: if the app is ever exploited, the attacker isn't root in the container.
# The official Node image already has a "node" user.
USER node

WORKDIR /app/apps/api

# Documents the port the api listens on (src/Service.ts). Publishing it is done in compose.
EXPOSE 9090

# node --import tsx: Node runs the TypeScript directly, in a single process. ("npx tsx" would
# start a second process, which makes stop signals and memory limits harder to get right.)
CMD ["node", "--import", "tsx", "src/index.ts"]
