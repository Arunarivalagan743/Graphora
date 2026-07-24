# HashAgile / Graphora

This workspace contains a React frontend and an Express backend for uploading CSV data into Neo4j.

## Upload flow

- The frontend parses the CSV for preview, schema generation, and data exploration.
- The selected CSV file is streamed directly to `POST /api/upload-stream` when the user exports to Neo4j.
- The backend parses the CSV as a stream, builds adaptive batches, and writes each batch to Neo4j in a transaction.
- The app still keeps the older JSON upload route for compatibility, but the default UI flow now uses streaming.

## Why streaming is used

- Lower browser memory pressure because the frontend does not send the whole CSV as one JSON payload.
- Better handling of large CSV files because the server can flush batches as it reads rows.
- Adaptive batching makes the upload size adjust to wide rows and slower database writes.

## Batch tuning

The backend adapts batch size automatically, but you can tune the behavior with environment variables:

- `UPLOAD_BATCH_BYTES` - target batch payload size in bytes
- `UPLOAD_MIN_BYTES` - minimum batch payload size in bytes
- `UPLOAD_MAX_BYTES` - maximum batch payload size in bytes
- `UPLOAD_MAX_ROWS` - maximum rows allowed in one batch

The frontend also supports optional batch tuning for the older JSON path through Vite environment variables:

- `VITE_API_URL` - backend base URL
- `VITE_UPLOAD_BATCH_BYTES` - target payload size for dynamic client-side batching
- `VITE_UPLOAD_MIN_ROWS` - minimum client-side batch rows
- `VITE_UPLOAD_MAX_ROWS` - maximum client-side batch rows

## Run locally

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm start
```

## Notes

- Keep secrets in `.env` files only.
- Do not commit API keys or Neo4j credentials.
- If `GEMINI_API_KEY` is missing, schema generation will fail fast with a clear server error.
