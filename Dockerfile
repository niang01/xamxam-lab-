# XAM-XAM LAB — image de production : Node.js 22 (plateforme, ngspice WebAssembly, passerelle MQTT) + Python 3.12 (pvlib, CoolProp).
ARG BASE_REGISTRY=docker.io/library
FROM ${BASE_REGISTRY}/node:22-bookworm-slim AS node

FROM ${BASE_REGISTRY}/python:3.12-slim-bookworm AS build
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /app
COPY package.json package-lock.json ./
# Proxy d'entreprise : autorité de certification supplémentaire facultative (secret de build, absent de l'image).
RUN --mount=type=secret,id=extra_ca,required=false sh -c 'if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm ci'
COPY . .
RUN rm -rf mobile && npm run build && npm prune --omit=dev

FROM ${BASE_REGISTRY}/python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY workers/requirements.txt workers/requirements.txt
RUN --mount=type=secret,id=extra_ca,required=false sh -c 'if [ -s /run/secrets/extra_ca ]; then export PIP_CERT=/run/secrets/extra_ca; fi; pip install --no-cache-dir -r workers/requirements.txt'
# PORT : fourni par l'hébergeur (Render : 10000) ; 10000 par défaut. Docker Compose fixe PORT=3100.
ENV NODE_ENV=production XX_PYTHON=/usr/local/bin/python PORT=10000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/workers ./workers
COPY --from=build /app/services ./services
COPY --from=build /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
RUN useradd --create-home --uid 10001 xamxam && mkdir -p /app/data /app/backups && chown -R xamxam /app/data /app/backups
USER xamxam
EXPOSE 10000 1883
# Écoute sur toutes les interfaces, port lu dans $PORT (next start, option -p liée à la variable PORT).
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
