FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system appgroup && adduser --system --group appuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    gcc \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY config/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    chown appuser:appgroup /entrypoint.sh

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]