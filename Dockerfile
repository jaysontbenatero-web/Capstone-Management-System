# Use Debian-based Node 20 slim (glibc required for @huggingface/transformers & ONNX Runtime)
FROM node:20-slim

# Install CA certificates for HTTPS (Hugging Face model download & Gmail SMTP TLS)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set application directory
WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production

# Copy project source files (filtered by .dockerignore)
COPY . .

# Ensure all persistent upload & Hugging Face model cache directories exist
RUN mkdir -p \
    /app/uploads/student_documents \
    /app/uploads/title_proposals \
    /app/uploads/signed_documents \
    /app/uploads/signatures \
    /app/uploads/profile_images \
    /app/uploads/defense_minutes \
    /app/uploads/consultation_documents \
    /app/uploads/chat_files \
    /app/.cache/huggingface

# Configure runtime environment defaults
ENV NODE_ENV=production
ENV PORT=3005
ENV HF_CACHE_DIR=/app/.cache/huggingface

# Expose application port
EXPOSE 3005

# Start the CapstoneX2 server
CMD ["node", "Server.js"]

