FROM node:22.19.0-alpine

ENV NODE_ENV=production \
    PORT=9000

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node app.js server.js ./
COPY --chown=node:node config ./config
COPY --chown=node:node domain ./domain
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node models ./models
COPY --chown=node:node routes ./routes
COPY --chown=node:node utils ./utils
COPY --chown=node:node validation ./validation

USER node

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 9000) + '/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "server.js"]
