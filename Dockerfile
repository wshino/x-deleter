FROM oven/bun:1

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY .env ./

RUN bun install

CMD ["bun", "start"] 