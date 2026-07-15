import 'dotenv/config';
import { logDeploy } from '../src/common/deploy-logger';

const entry = logDeploy();
console.log(`[deploy:log] recorded ${entry.sha} @ ${entry.timestamp}`);
