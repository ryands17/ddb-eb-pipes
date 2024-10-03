import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { sendError, sendSuccess, StatusCodes } from './utils/lambda';
import { logger } from './utils/logger';
import { Person } from './utils/model';

export const handler: APIGatewayProxyHandlerV2 = async (_, context) => {
  logger.addContext(context);
  logger.info('Fetching list of users');

  try {
    const people = await Person.scan.go();
    return sendSuccess(StatusCodes.OK, { people });
  } catch (error) {
    const message = `Couldn't fetch persons!`;
    logger.error(message, { error });

    return sendError(StatusCodes.INTERNAL_SERVER_ERROR, {
      message,
    });
  }
};
