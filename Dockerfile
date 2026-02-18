# Stage 1: Build Frontend
FROM node:18-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_JAVA_API_URL
ENV VITE_JAVA_API_URL=$VITE_JAVA_API_URL
RUN npm run build

# Stage 2: Build Java Service
FROM gradle:8.5-jdk17 AS java-build
WORKDIR /java-service
COPY java-service/build.gradle java-service/settings.gradle ./
COPY java-service/src ./src
RUN gradle bootJar --no-daemon

# Stage 3: Final Image
FROM python:3.10-slim

# Install system dependencies for code execution + JRE for the service
RUN apt-get update && apt-get install -y \
    openjdk-17-jre-headless \
    nodejs \
    npm \
    build-essential \
    golang-go \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy backend code
COPY backend/ ./

# Copy built frontend assets
RUN mkdir -p /frontend/dist
COPY --from=frontend-build /frontend/dist /frontend/dist

# Copy built Java JAR
COPY --from=java-build /java-service/build/libs/roolts-service.jar /app/roolts-service.jar

# Set environment variables
ENV PORT=5000
ENV FLASK_ENV=production
ENV PYTHONPATH=/app
ENV JAVA_SERVICE_URL=http://127.0.0.1:8080

# Setup start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 5000

# Command to run both services
CMD ["/app/start.sh"]
