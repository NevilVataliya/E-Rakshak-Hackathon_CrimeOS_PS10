FROM python:3.11-slim

WORKDIR /app

# System dependencies with apt cache mount
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-hin \
    tesseract-ocr-guj \
    ffmpeg \
    poppler-utils

RUN pip install --no-cache-dir "pip==26.2.1" "setuptools==83.0.0" "wheel==0.47.0"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_HTTP_TIMEOUT=300
ENV UV_CONCURRENT_DOWNLOADS=4

# Heavy fixed dependency (PyTorch) installed from standard PyPI fast global CDN
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch torchvision

# Copy requirements.txt and install remaining packages with uv cache mount
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --index-strategy unsafe-best-match -r requirements.txt

ARG HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
