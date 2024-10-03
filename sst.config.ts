/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'ddb-stream-pipes',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    $transform(sst.aws.Function, (args) => {
      args.architecture = 'arm64';
      args.runtime = 'nodejs20.x';
      args.logging = {
        retention: $app.stage === 'production' ? '1 month' : '1 week',
        format: 'text',
      };
    });

    // table to store person data
    const personsTable = new sst.aws.Dynamo('personsTable', {
      fields: { id: 'string' },
      primaryIndex: { hashKey: 'id' },
      stream: 'new-and-old-images',
      transform: { table: { billingMode: 'PAY_PER_REQUEST' } },
    });

    const api = new sst.aws.ApiGatewayV2('PersonsApi');
    api.route('GET /', {
      handler: 'functions/getPersons.handler',
    });

    api.route('POST /add', {
      handler: 'functions/addPerson.handler',
    });

    return { url: api.url };
  },
});
