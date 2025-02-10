# Use an official lightweight Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy only requirements.txt first
COPY requirements.txt .

# Upgrade pip and install dependencies
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Expose the port
EXPOSE 5000

# Run the Flask server
CMD ["python", "app.py"]
