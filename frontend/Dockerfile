# ── Frontend dev container ────────────────────────────────────────────────────
# Uses Node 20 LTS slim image.
# node_modules are installed inside the image; the src/ tree is bind-mounted at
# runtime (see docker-compose.yml volumes) so hot-module-reload works normally.

FROM node:20-slim

WORKDIR /app

# Install deps first — separate layer so it's cached unless package.json changes
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy the rest of the source (catches vite.config.ts, tsconfig, index.html, etc.)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# --host 0.0.0.0 is required so Vite listens on all interfaces inside the
# container, not just 127.0.0.1. Without this, the port-mapping is unreachable.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
