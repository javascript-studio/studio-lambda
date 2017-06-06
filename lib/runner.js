/*
 * Copyright (c) Maximilian Antoni <max@javascript.studio>
 */
'use strict';

const lambda_module = require(`${process.cwd()}/${process.argv[2]}`);

function invokedFunctionArn() {
  const region = process.env.AWS_REGION;
  const account = process.env.STUDIO_AWS_ACCOUNT || '0000';
  return `arn:aws:lambda:${region}:${account}:function:${this.functionName}`;
}

process.on('message', (m) => {
  const ms_start = Date.now();
  const context = m.context;
  Object.defineProperty(context, 'invokedFunctionArn', {
    get: invokedFunctionArn
  });
  const timeout = context.timeout;
  delete context.timeout;
  context.getRemainingTimeInMillis = () => {
    return timeout * 1000 - (Date.now() - ms_start);
  };
  lambda_module.handle(m.event, context, (err, data) => {
    const res = data ? JSON.stringify(data) : null;
    const mem = process.memoryUsage();
    process.send({ id: m.id, err, res, mem });
  });
});
