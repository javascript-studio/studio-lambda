'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, `Hello ${process.env[event.env]}`);
  }, 1);
};
