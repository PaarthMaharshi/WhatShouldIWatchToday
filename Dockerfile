# API-only container: a fallback for hosting the backend outside Vercel
# (Render, Railway, Hugging Face Spaces, ...). Build from the project root:
#   docker build -t whatshouldiwatchtoday-api .
#   docker run -p 8000:8000 whatshouldiwatchtoday-api
# Then deploy the frontend with VITE_API_URL=https://<your-api-host>.
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml ./ml
COPY backend ./backend
COPY artifacts ./artifacts

ENV PORT=8000 \
    CORS_ORIGINS=*
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
