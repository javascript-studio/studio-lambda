'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, `Other dir ${event.name}`);
  }, 1);
};
