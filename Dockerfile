# Production image (build happens locally, not on server)
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --maxsockets=1 && npm cache clean --force

# Copy pre-built files (built locally before push)
COPY build ./build
COPY server ./server

# Create data directory
RUN mkdir -p ./data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
