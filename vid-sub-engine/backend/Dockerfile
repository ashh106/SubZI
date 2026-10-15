
FROM node:20-bookworm-slim

ENV PYTHON_BIN=/opt/venv/bin/python
ENV PYTHONUNBUFFERED=1
ENV PYTHONUTF8=1
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

COPY requirements.txt ./requirements.txt

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

RUN mkdir -p /tmp/subzi-uploads

EXPOSE 5000

CMD ["npm", "start"]
