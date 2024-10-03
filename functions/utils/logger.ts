import { Logger } from '@aws-lambda-powertools/logger';
import { Resource } from 'sst/resource';

export const logger = new Logger({
  serviceName: Resource.App.name,
  environment: Resource.App.stage,
});
