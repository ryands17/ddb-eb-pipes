import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { Resource } from 'sst';
import { z } from 'zod';
import { sendError, sendSuccess, StatusCodes } from './utils/lambda';
import { logger } from './utils/logger';
import { Person } from './utils/model';

const EventSchema = z.object({
  body: z
    .string()
    .refine((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    })
    .transform((value) => JSON.parse(value))
    .pipe(
      z.object({
        firstName: z.string(),
        lastName: z.string(),
        age: z.number().positive(),
      }),
    ),
});

const client = new DynamoDBClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  logger.addContext(context);
  Person.setClient(client);
  Person.setTableName(Resource.personsTable.name);

  const parsedEvent = EventSchema.safeParse(event);

  if (!parsedEvent.success) {
    return sendError(StatusCodes.BAD_REQUEST, { message: parsedEvent.error });
  }

  try {
    const newPerson = await Person.create(parsedEvent.data.body).go();

    return sendSuccess(StatusCodes.CREATED, { person: newPerson.data });
  } catch (error) {
    const message = `Failed to create person`;
    logger.error(message, { error });

    return sendError(StatusCodes.INTERNAL_SERVER_ERROR, { message });
  }
};
