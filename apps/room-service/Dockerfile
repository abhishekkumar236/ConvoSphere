# Image for room-service. Build it from the REPO ROOT, because room-service imports
# packages/helpers and packages/types:
#   docker compose up -d --build room-service                       (root docker-compose.yml)
#   docker build -f apps/room-service/Dockerfile -t vmeet/room-service .
# Same two stages as apps/api/Dockerfile; see the comments there for why each step is as it is.

# Stage 1: cut the monorepo down to room-service and the workspace packages it imports.
FROM node:24.22.1-alpine AS prepare
WORKDIR /app
RUN npm install --global turbo@2.11.11
COPY . .
RUN turbo prune room-service --docker

# Stage 2: production dependencies + source, nothing else.
FROM node:24.22.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so a code-only change doesn't re-run npm ci.
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=prepare /app/out/full/ .

USER node
WORKDIR /app/apps/room-service

# No EXPOSE: room-service listens on nothing. It connects out to RabbitMQ and Redis only.
CMD ["node", "--import", "tsx", "src/index.ts"]
