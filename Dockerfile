# Frontend is pre-built by the deploy script (scripts/wsl.ps1 -Action deploy)
# before docker build runs. The dist/ folder is copied in directly.
FROM error_manage-ocr:latest

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata tesseract-ocr tesseract-ocr-chi-sim \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY scripts /app/scripts
COPY tools /app/tools
COPY legacy/xingce_v3 /app/legacy/xingce_v3
COPY legacy/v51_frontend /app/legacy/v51_frontend

# Copy pre-built Vue frontend (built by wsl.ps1 deploy/up before docker build)
COPY frontend/dist /app/frontend/dist

RUN python /app/scripts/build_legacy_assets.py

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
