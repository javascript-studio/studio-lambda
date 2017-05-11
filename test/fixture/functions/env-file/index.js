'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null,
      `${process.env.STUDIO_ENV_VAR} ${process.env.STUDIO_ENV_TPL}`);
  }, 1);
};
