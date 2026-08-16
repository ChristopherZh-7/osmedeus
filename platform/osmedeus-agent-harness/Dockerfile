FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    DSH_HOME=/home/node/.dsh \
    DSH_TELEMETRY_MODE=DISABLED \
    DSH_PERMISSION_MODE=workspace-write \
    OSM_DSH_HOST=0.0.0.0 \
    OSM_DSH_PORT=3080 \
    OSM_DSH_URL=http://127.0.0.1:3080

WORKDIR /app

COPY package.json package-lock.json ./
COPY plugins ./plugins
RUN npm ci --omit=dev --ignore-scripts

COPY scripts ./scripts
COPY skills ./skills

RUN mkdir -p /home/node/.dsh/runtime-workspace && \
    chown -R node:node /home/node/.dsh /app

USER node

EXPOSE 3080

HEALTHCHECK --interval=15s --timeout=6s --start-period=20s --retries=5 \
  CMD ["node", "./scripts/check.mjs"]

CMD ["npm", "run", "start"]
