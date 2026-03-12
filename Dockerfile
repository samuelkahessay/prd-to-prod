FROM node:22-slim AS build
WORKDIR /app
COPY console/package.json console/package-lock.json ./
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY console/package.json ./
COPY console/server.js ./
COPY console/lib/ ./lib/
COPY console/routes/ ./routes/
RUN mkdir -p /data
ENV HOST=0.0.0.0
ENV CONSOLE_PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
