FROM node:22-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/data/studioCatalog.ts ./src/data/studioCatalog.ts
COPY --from=builder /app/src/types/voiceover.ts ./src/types/voiceover.ts
COPY --from=builder /app/src/utils/audioLogic.ts ./src/utils/audioLogic.ts
COPY --from=builder /app/src/utils/scriptLogic.ts ./src/utils/scriptLogic.ts

EXPOSE 3000

CMD ["node", "server.ts"]
