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

# Install TeX Live and required packages
RUN apk add --no-cache \
    texlive \
    texlive-xetex \
    texlive-luatex \
    texlive-bibtex \
    texlive-bin-extra \
    texmf-dist-fontsextra \
    texmf-dist-langeuropean \
    texmf-dist-latexextra \
    texmf-dist-mathscience \
    texmf-dist-pictures \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    wget \
    curl

# Create app directory
WORKDIR /usr/src/app

# Copy production node_modules from build stage
COPY --from=development --chown=node:node /usr/src/app/node_modules ./node_modules

# Copy build artifacts and change ownership
COPY --from=development --chown=node:node /usr/src/app/dist ./dist

# Update font cache
RUN fc-cache -fv

# Switch to the non-root user
USER node

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD wget -q -O - http://localhost:3005/health || exit 1

# Expose API port
EXPOSE 3005

# Make Node.js properly handle signals
ENV NODE_OPTIONS="--unhandled-rejections=strict --max-old-space-size=2048"

# LaTeX environment variables
ENV XELATEX_PATH=/usr/bin/xelatex \
    LUALATEX_PATH=/usr/bin/lualatex \
    BIBTEX_PATH=/usr/bin/bibtex \
    TIMEOUT=60000 \
    MAX_MEMORY=2Gi \
    LOG_LEVEL=info

# Start the application
CMD ["node", "dist/main"] 