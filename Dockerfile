FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Install Python 3 and curl for data ingestion
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV SCHOLOMANCE_CORPUS_PATH=/var/data/scholomance_corpus.sqlite
ENV SCHOLOMANCE_DICT_PATH=/var/data/scholomance_dict.sqlite

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/codex ./codex
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/docs ./docs
COPY --from=build /app/mailer.adapter.js ./mailer.adapter.js
COPY --from=build /app/verseir_palette_payload.json ./verseir_palette_payload.json

EXPOSE 3000

CMD ["npm", "start"]
