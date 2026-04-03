FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install Python 3 and curl for data build (needed before npm ci for dictionary build)
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# --- Build dictionary and corpus at image-build time ---
# Attempts to download OEWN and build fresh DBs. If this fails (network
# issues, GitHub rate limits), we fall back to pre-existing local DBs.
RUN mkdir -p /app/data

RUN ( \
    curl -fL "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025.xml.gz" -o /app/english-wordnet-2025.xml.gz \
    && python3 scripts/build_scholomance_dict.py --db /app/data/scholomance_dict.sqlite --oewn_path /app/english-wordnet-2025.xml.gz --overwrite \
    && python3 scripts/build_super_corpus.py --db /app/data/scholomance_corpus.sqlite --dict /app/data/scholomance_dict.sqlite --overwrite \
    && rm -f /app/english-wordnet-2025.xml.gz \
) || echo "Dictionary build failed — will fall back to pre-existing local DBs"

# Fallback: if Docker build produced no DBs (curl failed, etc.), use the
# pre-built local copies that ship with the repo.
RUN test -s /app/data/scholomance_dict.sqlite || cp /app/scholomance_dict.sqlite /app/data/scholomance_dict.sqlite
RUN test -s /app/data/scholomance_corpus.sqlite || cp /app/scholomance_corpus.sqlite /app/data/scholomance_corpus.sqlite

# Verify DBs exist
RUN test -s /app/data/scholomance_dict.sqlite && test -s /app/data/scholomance_corpus.sqlite \
    || (echo "ERROR: No dictionary/corpus DBs available (build failed and no fallback)." && exit 1)

# --- App build ---
RUN npm run build
RUN npm prune --omit=dev

# --- Runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

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

# Copy pre-built dictionary and corpus (seed data — copied to persistent disk on first boot)
COPY --from=build /app/data/scholomance_dict.sqlite /app/data/scholomance_dict.sqlite
COPY --from=build /app/data/scholomance_corpus.sqlite /app/data/scholomance_corpus.sqlite

EXPOSE 3000

CMD node scripts/ritual-init.js --detach && node codex/server/index.js
