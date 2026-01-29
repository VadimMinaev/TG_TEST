FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# Use npm ci for faster, reliable installs
RUN npm ci

# Copy only necessary source files for build
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./

# Build React application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (faster)
RUN npm ci --omit=dev && npm cache clean --force

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