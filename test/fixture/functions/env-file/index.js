'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, `Hello ${process.env.STUDIO_ENV_VAR}`);
  }, 1);
};
