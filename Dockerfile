# syntax=docker/dockerfile:1

# =========================================
# Stage 1: Build Stage
# =========================================
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build process)
RUN npm ci

# Copy source code
COPY . .

# Build CSS bundle for production
RUN npm run build:prod

# =========================================
# Stage 2: Production Stage
# =========================================
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S quizmaster && \
    adduser -S quizmaster -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=quizmaster:quizmaster /app .

# Create necessary directories with proper permissions
RUN mkdir -p results uploads public/uploads && \
    chown -R quizmaster:quizmaster /app

# Switch to non-root user
USER quizmaster

# Expose the application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/ping', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]