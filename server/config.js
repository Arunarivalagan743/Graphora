import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 5000;
export const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';
export const UPLOAD_BATCH_BYTES = Number(process.env.UPLOAD_BATCH_BYTES) || 1.5 * 1024 * 1024;
export const UPLOAD_MIN_BYTES = Number(process.env.UPLOAD_MIN_BYTES) || 256 * 1024;
export const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024;
export const UPLOAD_MAX_ROWS = Number(process.env.UPLOAD_MAX_ROWS) || 1000;
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
