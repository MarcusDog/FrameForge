FROM node:24.11.1-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM deps AS test
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "npm run lint && npm run typecheck && npm run test -- --run && npm run build"]

FROM test AS build
ARG JAVA_API_BASE_URL=http://backend:8080
ENV JAVA_API_BASE_URL=$JAVA_API_BASE_URL
RUN npm run build

FROM node:24.11.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
