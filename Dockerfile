# Use an official Node runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Create a non-root user
RUN adduser -D myuser
USER myuser

# Define the command to run the app
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "$PORT"]