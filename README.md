# DynamoDB stream handler

This project uses EventBridge Pipes to handle DynamoDB stream events. EB Pipes send these events to SQS for further processing. DLQ is configured for both the source and the destination.

## Prerequisites

- Node LTS v20 or above
- PNPM
- AWS account with credentials configured

## Setup

- Clone the repo
- Run `pnpm i`
- Run `pnpm sst dev --stage dev` to run the project in live mode
