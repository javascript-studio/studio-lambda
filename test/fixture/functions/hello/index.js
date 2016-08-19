'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, `Hello ${event.name}`);
  }, 1);
};
