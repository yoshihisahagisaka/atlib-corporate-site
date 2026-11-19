# --- build stage ---
FROM node:24.22.3-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:24.22.3-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
# Alpine v3.24 provides OpenSSL 3.5.9-r0. Until the stable security backport
# lands, pin only the fixed OpenSSL family from Alpine edge/main; do not
# upgrade unrelated packages. Validate the resulting runtime image by scan.
RUN npm ci --omit=dev \
    && apk add --no-cache 'zlib>=1.4-r0' \
    && apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main \
      'openssl=3.5.9-r1' 'libssl3=3.5.9-r1' 'libcrypto3=3.5.9-r1' \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
COPY public ./public
EXPOSE 8080
CMD ["node", "dist/server.js"]
