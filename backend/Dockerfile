# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Install system dependencies
# - openjdk-17-jre-headless: For executing Java code
# - nodejs & npm: For executing JavaScript code
RUN apt-get update && apt-get install -y \
    openjdk-17-jre-headless \
    nodejs \
    npm \
    build-essential \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Set environment variable for the port (default 5000, Render overrides this)
ENV PORT=5000

# Expose the port
EXPOSE $PORT

# Command to run the application using gunicorn
# Adjust workers (-w) and timeout (-t) as needed
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT app:app"]
