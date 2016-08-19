'use strict';

const fs = require('fs');
const path = require('path');
const fork = require('child_process').fork;

function lambda_config(config_file_tpl, name, default_env) {
  const vars = {
    LAMBDA_NAME: name
  };
  const config_file = config_file_tpl.replace(/\${([A-Z_]+)}/g, (m, v) => {
    return default_env[v] || vars[v];
  });
  try {
    // eslint-disable-next-line no-sync
    const str = fs.readFileSync(config_file, 'utf8');
    return JSON.parse(str);
  } catch (e) {
    // Ignored
  }
  return {
    environment: default_env
  };
}

function fork_lambda(lambda_path_tpl, name, env, timeout, max_idle, on_kill) {
  const lambda_path = lambda_path_tpl.replace('${LAMBDA_NAME}', name);
  const lambda_file = path.basename(lambda_path);
  const cwd = path.dirname(lambda_path);

  const proc = fork(path.join(__dirname, 'runner.js'), [lambda_file], {
    cwd,
    env
  });
  const rpcs = {};
  let id = 0;
  proc.on('message', (m) => {
    if (rpcs[m.id]) {
      rpcs[m.id](m.err, JSON.parse(m.res));
      delete rpcs[m.id];
    }
  });
  function kill() {
    proc.kill();
    on_kill();
  }
  let idle_timer;
  return {
    invoke(event, callback) {
      if (idle_timer) {
        clearTimeout(idle_timer);
      }
      idle_timer = setTimeout(kill, max_idle);
      const timeout_timer = setTimeout(() => {
        kill();
        callback('E_TIMEOUT');
      }, timeout);
      rpcs[++id] = (err, value) => {
        clearTimeout(timeout_timer);
        callback(err, value);
      };
      proc.send({ id, event });
    }
  };
}

function kill_handler(entries, index) {
  return () => {
    entries.splice(index, 1);
  };
}

function fork_pool(lambda_path_tpl, config_file_tpl, name, default_env,
    timeout, max_idle) {
  const config = lambda_config(config_file_tpl, name, default_env);
  const entries = [];
  return {
    invoke(event, callback) {
      let entry = entries.find(entry => entry.active === false);
      if (!entry) {
        const lambda = fork_lambda(
          lambda_path_tpl,
          name,
          config.environment,
          config.timeout || timeout,
          max_idle,
          kill_handler(entries, entries.length)
        );
        entry = {
          lambda,
          active: false
        };
        entries.push(entry);
      }
      entry.active = true;
      entry.lambda.invoke(event, (err, value) => {
        entry.active = false;
        callback(err, value);
      });
    }
  };
}

exports.create = function (options = {}) {
  const lambda_path_tpl = options.lambda_path
    || 'functions/${LAMBDA_NAME}/index.js';
  const config_file_tpl = options.config_file
    || 'functions/${LAMBDA_NAME}/function.${AWS_PROFILE}.json';
  const default_env = options.env || {};
  const max_idle = options.max_idle || 60 * 60 * 1000;
  const timeout = options.timeout || 5000;
  const lambdas = {};

  return {
    invoke(name, event, callback) {
      const lambda = lambdas[name] || (lambdas[name] = fork_pool(
        lambda_path_tpl,
        config_file_tpl,
        name,
        default_env,
        timeout,
        max_idle
      ));
      lambda.invoke(event, callback);
    }
  };
};
