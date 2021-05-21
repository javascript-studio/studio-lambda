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

function setGetRemainingTimeInMillis(context) {
  const ms_start = Date.now();
  const timeout = context.timeout;
  delete context.timeout;
  context.getRemainingTimeInMillis = () => {
    return timeout * 1000 - (Date.now() - ms_start);
  };
}

process.on('message', (m) => {
  const context = m.context;
  Object.defineProperty(context, 'invokedFunctionArn', {
    get: invokedFunctionArn
  });
  setGetRemainingTimeInMillis(context);

  function handleResponse(err, data) {
    let res = null;
    if (data) {
      try {
        res = JSON.stringify(data);
      } catch (e) {
        err = { name: e.name, message: e.message, stack: e.stack };
      }
    }
    const mem = process.memoryUsage();
    process.send({ id: m.id, err, res, mem });
  }

  if (lambda_module.handle.length === 3) {
    lambda_module.handle(m.event, context, handleResponse);
    return;
  }

  lambda_module
    .handle(m.event, context)
    .then((data) => {
      handleResponse(null, data);
    })
    .catch(handleResponse);
});
