FROM node:22-alpine AS development

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build application
RUN npm run build

# Prune dev dependencies and keep production node_modules
RUN npm prune --omit=dev

FROM node:22-alpine AS production

# Set NODE_ENV
ARG NODE_ENV=production
ENV NODE_ENV=docker

# Create app directory
WORKDIR /usr/src/app

# Create logs directory with proper permissions BEFORE switching to node user
RUN mkdir -p /usr/src/app/logs && chown -R node:node /usr/src/app

# Copy production node_modules from build stage
COPY --from=development --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy build artifacts and change ownership
COPY --from=development --chown=node:node /usr/src/app/dist ./dist

# Ensure logs directory exists and is writable
RUN chown -R node:node /usr/src/app/logs

# Switch to the non-root user
USER node

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD wget -q -O - http://localhost:3001/health || exit 1

# Expose API port
EXPOSE 3001

# Make Node.js properly handle signals
ENV NODE_OPTIONS="--unhandled-rejections=strict"

# Start the application
CMD ["node", "dist/main"]
