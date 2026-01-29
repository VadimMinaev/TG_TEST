FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies with memory and CPU limits
# Use single-threaded install to reduce memory usage
RUN npm ci --prefer-offline --no-audit --maxsockets=1

# Copy only necessary source files for build
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./

# Build React application with memory limits
# Node.js memory limit for Vite build
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies with limits
RUN npm ci --omit=dev --prefer-offline --no-audit --maxsockets=1 && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/build ./build

# Copy server files
COPY server ./server

# Create data directory if it doesn't exist
RUN mkdir -p ./data

EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

CMD ["npm", "start"]