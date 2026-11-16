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
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
EXPOSE 8080
CMD ["node", "dist/server.js"]
