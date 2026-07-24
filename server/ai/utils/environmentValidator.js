import { NEO4J_URI, NEO4J_USERNAME, PORT } from '../../config.js';

/**
 * Validates critical environment variables at startup.
 */
export function validateEnvironment() {
  console.log('-------------------------------------------------');
  console.log('[EnvironmentValidator] Validating production setup...');

  const warnings = [];
  const status = {
    port: PORT,
    neoUri: NEO4J_URI,
    neoUser: NEO4J_USERNAME,
    groqKey: Boolean(process.env.GROQ_API_KEY),
    geminiKey: Boolean(process.env.GEMINI_API_KEY)
  };

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    warnings.push('Neither GROQ_API_KEY nor GEMINI_API_KEY is set in server/.env file.');
  } else if (process.env.GROQ_API_KEY) {
    console.log('[EnvironmentValidator] Groq Llama 3.3 70B Engine is ACTIVE for ultra-fast AI inference!');
  }

  if (!process.env.NEO4J_URI) {
    warnings.push('NEO4J_URI is using default bolt://localhost:7687.');
  }

  if (warnings.length > 0) {
    console.warn('[EnvironmentValidator] CONFIGURATION WARNINGS:');
    warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
  } else {
    console.log('[EnvironmentValidator] Environment validation passed clean.');
  }
  console.log('-------------------------------------------------');

  return status;
}
