FROM node:22-slim AS build
WORKDIR /app/console
COPY console/package.json console/package-lock.json ./
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y bash curl gh git jq python3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/console/node_modules ./console/node_modules
COPY . .
RUN mkdir -p /data
ENV HOST=0.0.0.0
ENV CONSOLE_PORT=8080
WORKDIR /app/console
EXPOSE 8080
CMD ["node", "server.js"]
