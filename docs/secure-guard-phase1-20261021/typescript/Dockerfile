ARG NODE_BASE_IMAGE
FROM ${NODE_BASE_IMAGE} AS build
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
USER node
ENTRYPOINT ["node","dist/entrypoint.js"]
