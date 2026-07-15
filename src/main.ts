import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from './app.module';
import { logDeploy } from './common/deploy-logger';
import { ErrorReporterFilter } from './common/error-reporter.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global error-reporting filter: catches everything, logs + reports, never crashes.
  app.useGlobalFilters(new ErrorReporterFilter());

  // Ensure indexes exist — especially the unique index on orders.orderNumber.
  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(
    Object.values(connection.models).map((model) => model.syncIndexes()),
  );
  logger.log('syncIndexes() completed for all models');

  // Record this boot as a deploy in the single timeline the responder reads.
  const entry = logDeploy();
  logger.log(`deploy logged: ${entry.sha} @ ${entry.timestamp}`);

  const port = Number(process.env.PORT ?? '3000');
  await app.listen(port);
  logger.log(`mini-shop listening on http://localhost:${port}`);
}

void bootstrap();
