FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache vips-dev vips-cpp --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing/
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3005
CMD ["node", "server.js"]
