FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-hin \
    tesseract-ocr-guj \
    ffmpeg \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "pip==26.2.1" "setuptools==83.0.0" "wheel==0.47.0"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY requirements.txt .

ENV UV_HTTP_TIMEOUT=300
ENV UV_CONCURRENT_DOWNLOADS=4

# Install torch separately first (large package, needs its own timeout budget)
RUN uv pip install --system \
    --index-strategy unsafe-best-match \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    "torch==2.6.0+cpu" torchvision

# Install remaining packages
RUN uv pip install --system --index-strategy unsafe-best-match -r requirements.txt

ARG HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
