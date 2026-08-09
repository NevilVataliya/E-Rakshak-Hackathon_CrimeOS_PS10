FROM python:3.11-slim

WORKDIR /app

# System dependencies (including curl)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-hin \
    tesseract-ocr-guj \
    ffmpeg \
    poppler-utils \
    curl

RUN pip install --no-cache-dir "pip==26.2.1" "setuptools==83.0.0" "wheel==0.47.0"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_HTTP_TIMEOUT=300
ENV UV_CONCURRENT_DOWNLOADS=4

# Fast direct download of light 178MB CPU PyTorch wheel using curl with explicit -o filename
RUN curl -o torch-2.6.0+cpu-cp311-cp311-linux_x86_64.whl https://download.pytorch.org/whl/cpu/torch-2.6.0%2Bcpu-cp311-cp311-linux_x86_64.whl && \
    pip install torch-2.6.0+cpu-cp311-cp311-linux_x86_64.whl torchvision --index-url https://download.pytorch.org/whl/cpu && \
    rm torch-2.6.0+cpu-cp311-cp311-linux_x86_64.whl

# Copy requirements.txt and install remaining packages
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --index-strategy unsafe-best-match --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

ARG HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
