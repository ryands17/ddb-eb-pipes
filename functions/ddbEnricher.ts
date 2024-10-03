import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

type Event = DynamoDBStreamEvent['Records'];

export const handler = async (event: Event) => {
  const record = event[0];

  if (record.dynamodb && record.dynamodb.NewImage) {
    // @ts-ignore
    const person = unmarshall(record.dynamodb.NewImage);
    return person;
  }

  return {};
};
