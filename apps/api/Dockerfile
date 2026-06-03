FROM oven/bun:1.2-debian
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg yt-dlp ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 复制完整 monorepo（.dockerignore 排除无关文件），避免 workspace 缺包
COPY package.json bunfig.toml bun.lock ./
COPY packages ./packages
COPY apps ./apps

RUN bun install \
  && cd packages/shared && bun run build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/clipscribe
ENV RENDER=true

EXPOSE 10000

CMD ["bun", "run", "start"]
