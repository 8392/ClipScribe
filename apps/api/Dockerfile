FROM oven/bun:1.2
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg yt-dlp ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bunfig.toml bun.lock ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN bun install --frozen-lockfile \
  && cd packages/shared && bun run build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3000
ENV TEMP_DIR=/tmp/clipscribe

EXPOSE 3000

CMD ["bun", "run", "start"]
