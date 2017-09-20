'use strict';

const count = 1024 * 1024;

exports.handle = function (event, context, callback) {
  const entries = [];
  try {
    for (let i = 0; i < count; i++) {
      entries.push('a');
    }
    callback(null, 'Allocated');
  } catch (e) {
    callback(String(process.memoryUsage().rss));
  }
};
