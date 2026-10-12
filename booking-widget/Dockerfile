# Build the static bundle, then serve it with Nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Optional: docker build --build-arg VITE_API_URL=https://agenda.example.com/api .
ARG VITE_API_URL=""
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
