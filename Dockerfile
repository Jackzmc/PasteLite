FROM node:24-alpine AS builder

WORKDIR /build

# Setup deps
COPY package*.json /build/
COPY yarn.lock* /build/

RUN yarn

# Build app
COPY . .

RUN npx tsc

# FROM node:24-alpine AS base
# COPY --from=builder /build/dist /app

CMD ["node", "./dist/index.js"]