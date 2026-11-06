FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/mobile/package.json ./apps/mobile/

RUN npm ci

COPY apps/desktop ./apps/desktop
COPY turbo.json ./

WORKDIR /app/apps/desktop
RUN npm run build

FROM nginx:alpine

COPY apps/desktop/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/desktop/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
