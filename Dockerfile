# Crew Health Console API (server/). The web app is deployed separately (Vercel).
#   docker build -t crew-health-api .
#   docker run -p 8787:8787 -v crew-health-data:/data -e CORS_ORIGINS=https://your-app.vercel.app crew-health-api
# Then create the crew inside the container:
#   docker exec -it <container> node dist-server/crewCli.js demo

# 1. Build: bundle the server and the crew tool into dist-server/ (self-contained JS files).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:server

# 2. Run: plain Node with the two bundles; no node_modules needed.
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/chc.db
WORKDIR /app
COPY --from=build /app/dist-server ./dist-server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist-server/index.js"]
