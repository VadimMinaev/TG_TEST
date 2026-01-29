FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source files
COPY . .

# Build React application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/build ./build

# Copy server files
COPY server ./server

# Copy other necessary files
COPY data ./data

EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

CMD ["npm", "start"]