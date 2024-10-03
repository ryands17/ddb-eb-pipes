import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { Resource } from 'sst';
import { sendError, sendSuccess, StatusCodes } from './utils/lambda';
import { logger } from './utils/logger';
import { Person } from './utils/model';

const client = new DynamoDBClient();

export const handler: APIGatewayProxyHandlerV2 = async (_, context) => {
  logger.addContext(context);
  logger.info('Fetching list of users');

  Person.setClient(client);
  Person.setTableName(Resource.personsTable.name);

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
