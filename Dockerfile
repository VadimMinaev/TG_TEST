# Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (including dev for build)
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --maxsockets=1 && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --maxsockets=1 && npm cache clean --force

# Copy built files and server
COPY --from=builder /app/build ./build
COPY --from=builder /app/server ./server

# Create data directory if it doesn't exist
RUN mkdir -p ./data

EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

CMD ["npm", "start"]
