/*
 * Copyright (c) Maximilian Antoni <max@javascript.studio>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const fork = require('child_process').fork;
const xtend = require('xtend');

function format_json(obj) {
  return JSON.stringify(obj)
    .replace(/"(Authorization|token)"\:"(.+)"/m, (_, a, b) => {
      const p = _.indexOf(b);
      return `${_.substring(0, p)}...${_.substring(p + b.length)}`;
    });
}

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

function fork_lambda(lambda_path_tpl, name, environment, timeout, max_idle,
    on_kill) {
  const lambda_path = lambda_path_tpl.replace('${LAMBDA_NAME}', name);
  const lambda_file = path.basename(lambda_path);
  const cwd = path.dirname(lambda_path);
  const env = xtend(environment, {
    AWS_REGION: 'local',
    AWS_ACCESS_KEY_ID: 'akid',
    AWS_SECRET_ACCESS_KEY: 'secret',
    STUDIO_DB_ENDPOINT: process.env.STUDIO_DB_ENDPOINT,
    STUDIO_S3_ENDPOINT: process.env.STUDIO_S3_ENDPOINT,
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  });

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
  let timeout_timer;
  let idle_timer;
  proc.on('error', (err) => {
    console.error(` 🚨  Lambda ${name} error ${String(err)}`);
    if (idle_timer) {
      clearTimeout(idle_timer);
      idle_timer = null;
    }
    if (timeout_timer) {
      clearTimeout(timeout_timer);
      timeout_timer = null;
    }
    if (on_kill) {
      on_kill();
      on_kill = null;
    }
  });
  proc.on('exit', (code, signal) => {
    if (code) {
      console.error(
        ` 🚨  Lambda ${name} exited with code ${code} and signal ${signal}`
      );
    }
    if (idle_timer) {
      clearTimeout(idle_timer);
      idle_timer = null;
    }
    if (timeout_timer) {
      clearTimeout(timeout_timer);
      timeout_timer = null;
    }
    if (on_kill) {
      on_kill();
      on_kill = null;
    }
  });
  function kill(signal = 'SIGTERM') {
    proc.kill(signal);
    if (on_kill) {
      on_kill();
      on_kill = null;
    }
  }
  return {
    invoke(event, context, callback) {
      if (idle_timer) {
        clearTimeout(idle_timer);
      }
      idle_timer = setTimeout(kill, max_idle);
      timeout_timer = setTimeout(() => {
        console.warn(` ⏲  Lambda ${name} (${timeout} ms)`);
        kill('SIGKILL');
        callback(JSON.stringify({ code: 'E_TIMEOUT' }));
      }, timeout);
      rpcs[++id] = (err, value) => {
        clearTimeout(timeout_timer);
        console.info(
          ` 📤  Lambda ${name} #${id} response=${format_json(err || value)}`
        );
        callback(err, value);
      };
      console.info(` 📥  Lambda ${name} #${id} event=${format_json(event)}`);
      proc.send({ id, event, context });
    }
  };
}

function kill_handler(entries, index, name) {
  return () => {
    console.info(` ⛔️  Lamba ${name}`);
    entries.splice(index, 1);
  };
}

function fork_pool(lambda_path_tpl, config_file_tpl, name, default_env,
    timeout, max_idle) {
  const config = lambda_config(config_file_tpl, name, default_env);
  const entries = [];
  return {
    invoke(event, context, callback) {
      let entry = entries.find(entry => entry.active === false);
      if (!entry) {
        console.info(` 🚀  Lambda ${name}`);
        const lambda = fork_lambda(
          lambda_path_tpl,
          name,
          config.environment,
          config.timeout || timeout,
          max_idle,
          kill_handler(entries, entries.length, name)
        );
        entry = {
          lambda,
          active: false
        };
        entries.push(entry);
      }
      entry.active = true;
      entry.lambda.invoke(event, context, (err, value) => {
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
    invoke(name, event, context, callback) {
      if (typeof context === 'function') {
        callback = context;
        context = {};
      }
      const lambda = lambdas[name] || (lambdas[name] = fork_pool(
        lambda_path_tpl,
        config_file_tpl,
        name,
        default_env,
        timeout,
        max_idle
      ));
      lambda.invoke(event, context, callback);
    }
  };
};
