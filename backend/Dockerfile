FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY src ./src
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
