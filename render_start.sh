#!/bin/bash
echo "Starting EdgePilot Simulator..."
python simulator/simulate_sensors.py &

echo "Starting EdgePilot Backend API..."
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
