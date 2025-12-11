# Build stage
FROM node:20-alpine as builder
WORKDIR /app

ARG VITE_AAD_CLIENT_ID
ARG VITE_AAD_TENANT_ID=common
ARG VITE_AAD_REDIRECT_URI=http://localhost:5173
ARG VITE_API_BASE=http://localhost:4000

ENV VITE_AAD_CLIENT_ID=${VITE_AAD_CLIENT_ID}
ENV VITE_AAD_TENANT_ID=${VITE_AAD_TENANT_ID}
ENV VITE_AAD_REDIRECT_URI=${VITE_AAD_REDIRECT_URI}
ENV VITE_API_BASE=${VITE_API_BASE}

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Serve static
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
