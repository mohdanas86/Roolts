#!/bin/bash

# Start the Java Analysis Service in the background
echo ">>> Starting Java Analysis Service..."
java -jar /app/roolts-service.jar --server.port=8080 &

# Start the Python Flask Backend with Gunicorn
echo ">>> Starting Python Flask Backend..."
gunicorn --bind 0.0.0.0:${PORT:-5000} app:app --timeout 120 --workers 4
