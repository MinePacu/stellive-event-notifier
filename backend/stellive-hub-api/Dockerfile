FROM node:22-alpine AS deps
WORKDIR /app/backend/stellive-hub-api

COPY backend/stellive-hub-api/package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/backend/stellive-hub-api/node_modules ./backend/stellive-hub-api/node_modules
COPY backend/stellive-hub-api/package*.json ./backend/stellive-hub-api/
COPY backend/stellive-hub-api/tsconfig.json ./backend/stellive-hub-api/
COPY backend/stellive-hub-api/prisma ./backend/stellive-hub-api/prisma
COPY backend/stellive-hub-api/src ./backend/stellive-hub-api/src
COPY shared ./shared

WORKDIR /app/backend/stellive-hub-api
RUN node ./node_modules/prisma/build/index.js generate
RUN node ./node_modules/typescript/bin/tsc -p tsconfig.json
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/backend/stellive-hub-api/package*.json ./backend/stellive-hub-api/
COPY --from=build /app/backend/stellive-hub-api/node_modules ./backend/stellive-hub-api/node_modules
COPY --from=build /app/backend/stellive-hub-api/dist ./backend/stellive-hub-api/dist
COPY --from=build /app/backend/stellive-hub-api/prisma ./backend/stellive-hub-api/prisma
COPY --from=build /app/shared ./shared

WORKDIR /app/backend/stellive-hub-api
EXPOSE 4000
CMD ["npm", "start"]
