FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN cp src/db/*.sql dist/db/ \
  && mkdir -p dist/db/snapshot-art \
  && cp src/db/snapshot-art/* dist/db/snapshot-art/

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY .env.example ./
COPY .env* ./
RUN if [ ! -f .env ]; then cp .env.example .env; fi \
    && mkdir -p /app/uploads/cards /app/public/boosters \
    && chown -R node:node /app/uploads /app/public /app/.env \
    && chmod 600 /app/.env

EXPOSE 3001

USER node

CMD ["node", "dist/index.js"]
