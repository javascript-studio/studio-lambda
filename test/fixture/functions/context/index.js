'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, JSON.stringify(context));
  }, 1);
};
