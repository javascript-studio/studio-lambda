'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, context.getRemainingTimeInMillis());
  }, 1);
};
