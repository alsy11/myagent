FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Create public directory if not exists
RUN mkdir -p public

EXPOSE 3000

CMD ["node", "src/server.js"]
