# Production stage - uses pre-built files if available
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --prefer-offline --no-audit --maxsockets=1 && npm cache clean --force

# Copy built files (should be built locally)
COPY build ./build

# Copy server files
COPY server ./server

# Create data directory if it doesn't exist
RUN mkdir -p ./data

EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

CMD ["npm", "start"]
