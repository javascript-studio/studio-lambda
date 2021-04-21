'use strict';

exports.handle = function () {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // eslint-disable-next-line prefer-promise-reject-errors
      reject(`${process.env.STUDIO_ENV_VAR} ${process.env.STUDIO_ENV_TPL}`);
    }, 1);
  });
};
