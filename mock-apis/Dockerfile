FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
