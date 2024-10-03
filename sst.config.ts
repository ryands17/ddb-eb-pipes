/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'ddb-stream-pipes',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: {
          region: 'eu-west-1',
          defaultTags: {
            tags: { env: input.stage, stack: 'ddb-stream-pipes' },
          },
        },
      },
    };
  },
  async run() {
    const acc = await aws.getCallerIdentity();

    $transform(sst.aws.Function, (args) => {
      args.architecture = 'arm64';
      args.runtime = 'nodejs20.x';
      args.logging = {
        retention: $app.stage === 'production' ? '1 month' : '1 week',
        format: 'text',
      };
      args.environment = {
        ...args.environment,
        POWERTOOLS_DEV: $app.stage === 'production' ? 'false' : 'true',
      };
    });

    // table to store person data
    const personsTable = new sst.aws.Dynamo('personsTable', {
      fields: { id: 'string' },
      primaryIndex: { hashKey: 'id' },
      stream: 'new-and-old-images',
      transform: { table: { billingMode: 'PAY_PER_REQUEST' } },
    });

    // dynamodb stream dlq
    const streamDlq = new sst.aws.Queue('ddbStreamDlq', {
      visibilityTimeout: '5 minutes',
    });

    // queue and dlq for streams destination via eventbridge pipes
    const addPersonDlq = new sst.aws.Queue('addPersonDlq', {
      visibilityTimeout: '5 minutes',
    });
    const addPersonQueue = new sst.aws.Queue('addPersonQueue', {
      visibilityTimeout: '5 minutes',
      dlq: addPersonDlq.arn,
    });

    addPersonQueue.subscribe('functions/sendNewPerson.handler', {
      batch: { size: 10 },
    });

    // enricher lambda to send the parse the dynamodb stream record
    const ddbEnricher = new sst.aws.Function('ddbEnricher', {
      handler: 'functions/ddbEnricher.handler',
    });

    // eventbridge pipes role
    const ebPipesRole = new aws.iam.Role('ebPipesRole', {
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: {
          Effect: 'Allow',
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'pipes.amazonaws.com',
          },
          Condition: {
            StringEquals: {
              'aws:SourceAccount': acc.accountId,
            },
          },
        },
      }),
    });

    // eb pipes source policy
    const sourcePolicy = new aws.iam.RolePolicy('sourcePolicy', {
      role: ebPipesRole.id,
      policy: $jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'dynamodb:DescribeStream',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:ListStreams',
            ],
            Resource: [personsTable.nodes.table.streamArn],
          },
        ],
      }),
    });

    // eb pipes source dlq policy
    const dlqPolicy = new aws.iam.RolePolicy('dlqPolicy', {
      role: ebPipesRole.id,
      policy: $jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:ReceiveMessage',
              'sqs:SendMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
            ],
            Resource: [streamDlq.arn],
          },
        ],
      }),
    });

    // eb pipes enricher policy
    const enricherPolicy = new aws.iam.RolePolicy('enricherPolicy', {
      role: ebPipesRole.id,
      policy: $jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['lambda:InvokeFunction'],
            Resource: [ddbEnricher.arn],
          },
        ],
      }),
    });

    // eb pipes target policy
    const targetPolicy = new aws.iam.RolePolicy('targetPolicy', {
      role: ebPipesRole.id,
      policy: $jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:ReceiveMessage',
              'sqs:SendMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
            ],
            Resource: [addPersonQueue.arn],
          },
        ],
      }),
    });

    // eventbridge pipe configuration
    const ddbSqsPipe = new aws.pipes.Pipe(
      'ddbSqsPipe',
      {
        roleArn: ebPipesRole.arn,
        source: personsTable.nodes.table.streamArn,
        sourceParameters: {
          dynamodbStreamParameters: {
            startingPosition: 'TRIM_HORIZON',
            batchSize: 10,
            deadLetterConfig: { arn: streamDlq.arn },
            maximumRetryAttempts: 3,
            maximumRecordAgeInSeconds: 600,
          },
          filterCriteria: {
            filters: [{ pattern: $jsonStringify({ eventName: ['INSERT'] }) }],
          },
        },
        enrichment: ddbEnricher.arn,
        target: addPersonQueue.arn,
      },
      {
        dependsOn: [sourcePolicy, dlqPolicy, targetPolicy, enricherPolicy],
      },
    );

    // persons api
    const api = new sst.aws.ApiGatewayV2('PersonsApi');

    api.route('GET /', {
      handler: 'functions/getPersons.handler',
      link: [personsTable],
    });

    api.route('POST /add', {
      handler: 'functions/addPerson.handler',
      link: [personsTable],
    });

    return { url: api.url };
  },
});
