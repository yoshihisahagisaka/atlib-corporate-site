ARG NODE_BASE_IMAGE
FROM ${NODE_BASE_IMAGE} AS build
ARG NODE_BASE_IMAGE
RUN node -e "if(!/^node@sha256:[a-f0-9]{64}$/.test(process.env.NODE_BASE_IMAGE)||process.versions.node.split('.')[0]!=='20')process.exit(1)"
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build
FROM ${NODE_BASE_IMAGE} AS runtime
ARG SOURCE_SHA
LABEL org.opencontainers.image.revision=${SOURCE_SHA}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY runtime-policy.json ./runtime-policy.json
RUN node -e "const p=require('./runtime-policy.json');require('./dist/plan').checkPolicy(p);if(p.source_sha!==process.env.SOURCE_SHA)process.exit(1)"
USER node
ENTRYPOINT ["node","dist/entrypoint.js"]

