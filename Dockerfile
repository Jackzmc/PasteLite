FROM node:24-alpine AS builder

WORKDIR /build

# Setup deps
COPY package*.json /build/
COPY yarn.lock* /build/

RUN yarn

# Build app
COPY . .

RUN npx tsc

FROM node:24-alpine AS prod
# FROM node:bookworm AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json /app/
COPY yarn.lock* /app/
COPY static /app/static
RUN yarn --production && mkdir /app/db
COPY --from=builder /build/dist /app/dist/

CMD ["node", "./dist/index.js"]