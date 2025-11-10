FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main.js"]
