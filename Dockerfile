# --- Stage 1: Build the App ---
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files first to cache dependencies
COPY package.json ./
# (If you see package-lock.json in your folder, uncomment the next line)
# COPY package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Fixes the "Rollup failed to resolve react-is" error
RUN npm install react-is --legacy-peer-deps

# Copy all project files
COPY . .

# Accept the API Key during build
ARG VITE_GOOGLE_API_KEY
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY

# Accept Docker variables during build
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID

# Build the project (Vite creates a 'dist' folder)
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Copy the build output to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config (we will create this in Step 3)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]