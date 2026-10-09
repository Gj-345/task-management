FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_TASK_URL
ARG NEXT_PUBLIC_NOTIFICATION_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
    NEXT_PUBLIC_TASK_URL=$NEXT_PUBLIC_TASK_URL \
    NEXT_PUBLIC_NOTIFICATION_URL=$NEXT_PUBLIC_NOTIFICATION_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
