import { SQSHandler } from 'aws-lambda';
import { sendBatchFailures } from './utils/lambda';
import { logger } from './utils/logger';

export const handler: SQSHandler = async (event, context) => {
  logger.addContext(context);

  logger.info(`Processing new person records`);

  for (const record of event.Records) {
    const person = JSON.parse(record.body);
    logger.info('Sending person to SNS topic:', { person });
    // TODO: send to SNS topic in a batch
  }

  return sendBatchFailures([]);
};
