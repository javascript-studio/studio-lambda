/*
 * Copyright (c) Maximilian Antoni <max@javascript.studio>
 */
'use strict';

const lambda_module = require(`${process.cwd()}/${process.argv[2]}`);

process.on('message', (m) => {
  lambda_module.handle(m.event, m.context, (err, data) => {
    const res = data ? JSON.stringify(data) : null;
    const mem = process.memoryUsage();
    process.send({ id: m.id, err, res, mem });
  });
});
