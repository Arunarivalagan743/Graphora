import { startServer } from './app.js';
import { validateEnvironment } from './ai/utils/environmentValidator.js';

validateEnvironment();
startServer();
