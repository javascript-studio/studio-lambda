'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, `Debug ${process.env.DEBUG}`);
  }, 1);
};
