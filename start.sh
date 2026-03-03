#!/bin/bash

# Start the Java Analysis Service in the background (Limit memory to 256MB)
echo ">>> Starting Java Analysis Service..."
java -Xms128m -Xmx256m -jar /app/roolts-service.jar --server.port=8080 &

# Start the Python Flask Backend with Gunicorn (Use threads instead of processes to save memory)
echo ">>> Starting Python Flask Backend..."
gunicorn --bind 0.0.0.0:${PORT:-5000} app:app --timeout 120 --workers 1 --threads 8
