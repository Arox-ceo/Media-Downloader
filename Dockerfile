FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/ytdlp \
    && /opt/ytdlp/bin/pip install --no-cache-dir 'yt-dlp[default]==2026.10.26'
ENV PATH="/opt/ytdlp/bin:${PATH}" HOST=0.0.0.0 PORT=10000 NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json server.mjs platforms.mjs ./
COPY --chown=node:node public ./public
RUN mkdir downloads && chown node:node downloads
USER node
EXPOSE 10000
CMD ["node", "server.mjs"]
