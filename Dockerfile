# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Install LibreOffice and Pandoc (for DOCX to HTML conversion)
RUN apt-get update && \
    apt-get install -y libreoffice libreoffice-writer pandoc && \
    apt-get clean

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
ADD . /app

# Install any necessary Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV NAME DocumentViewer

# Run app.py when the container launches
CMD ["python", "app.py"]
