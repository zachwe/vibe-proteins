FROM python:3.11-slim

# Install Litestream
RUN apt-get update && apt-get install -y ca-certificates wget && \
    wget -qO- https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz | tar xz -C /usr/local/bin && \
    rm -rf /var/lib/apt/lists/*

# Install Datasette and plugins
RUN pip install --no-cache-dir datasette datasette-auth-passwords

WORKDIR /app

# Copy config files
COPY datasette/litestream.yml /etc/litestream.yml
COPY datasette/metadata.json /app/metadata.json
COPY datasette/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directory
RUN mkdir -p /data

EXPOSE 8080

CMD ["/app/start.sh"]
