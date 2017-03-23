/*
 * Copyright (c) Maximilian Antoni <max@javascript.studio>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const fork = require('child_process').fork;
const xtend = require('xtend');
const logger = require('@studio/log');

const log = logger('Lambda');

function formatJson(obj) {
  if (typeof obj === 'string') {
    return obj;
  }
  const json = xtend(obj);
  if (json.Authorization) {
    json.Authorization = '...';
  }
  if (json.authorizationToken) {
    const type = json.authorizationToken.split(' ')[0];
    json.authorizationToken = `${type} ...`;
  }
  if (json.token) {
    json.token = '...';
  }
  if (typeof json.event === 'object') {
    json.event = formatJson(json.event);
  }
  return json;
}

function lambdaConfig(base_dir, config_file_tpl, name, default_env) {
  const vars = {
    LAMBDA_NAME: name
  };
  let config_file = config_file_tpl.replace(/\${([A-Z_]+)}/g, (m, v) => {
    return vars[v] || default_env[v] || process.env[v];
  });
  let str = '{}';
  try {
    // eslint-disable-next-line no-sync
    str = fs.readFileSync(path.join(base_dir, config_file), 'utf8');
  } catch (e) {
    // File not found
    config_file = '<defaults>';
  }
  log.disk({ name, config_file });
  const config = JSON.parse(str);
  config.environment = xtend(config.environment || {}, default_env);
  return config;
}

function forkLambda(base_dir, lambda_path_tpl, name, environment, timeout,
    max_idle, on_kill) {
  const lambda_path = lambda_path_tpl.replace('${LAMBDA_NAME}', name);
  const lambda_file = path.basename(lambda_path);
  const cwd = path.join(base_dir, path.dirname(lambda_path));
  const env = xtend(environment, {
    HOME: process.env.HOME, // Required for aws-sdk to find the credentials
    AWS_PROFILE: process.env.AWS_PROFILE,
    AWS_REGION: process.env.AWS_REGION,
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  });
  if (process.env.DEBUG) {
    env.DEBUG = process.env.DEBUG;
  }

  const inspect_lambda = process.env.STUDIO_LAMBDA_INSPECT === name;
  const proc = fork(path.join(__dirname, 'runner.js'), [lambda_file], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
    execArgv: inspect_lambda ? ['--inspect'] : []
  });
  const rpcs = {};
  let id = 0;
  let buf = '';
  proc.stdout.on('data', (chunk) => {
    buf += chunk;
    let p = buf.indexOf('\n');
    while (p !== -1) {
      const line = buf.substring(0, p);
      let json = null;
      try {
        json = JSON.parse(line);
      } catch (e) {
        // Fall through to `log.ignore(line)`
      }
      if (json && json.ns && json.topic) {
        const args = [];
        if (json.msg) {
          args.push(json.msg);
        }
        if (json.data) {
          args.push(formatJson(json.data));
        }
        if (json.stack) {
          args.push(json.stack);
        }
        logger(`Lambda ${name} ${json.ns}`)[json.topic](...args);
      } else {
        logger(`Lambda ${name}`).ignore(line);
      }
      buf = buf.substring(p + 1);
      p = buf.indexOf('\n');
    }
  });
  proc.on('message', (m) => {
    const fn = rpcs[m.id];
    if (fn) {
      delete rpcs[m.id];
      let res;
      try {
        res = JSON.parse(m.res);
      } catch (e) {
        fn(new Error(`Lambda ${name} message parse error in '${m.res}': ${e}`));
        return;
      }
      const mem = m.mem;
      log.numbers({
        name,
        ms_time: Date.now() - fn.started,
        bytes_rss: mem.rss,
        bytes_heapTotal: mem.heapTotal,
        bytes_heapUsed: mem.heapUsed
      });
      fn(m.err, res);
    }
  });
  let timeout_timer;
  let idle_timer;
  proc.on('error', (err) => {
    log.error({ name }, err);
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
      log.error({ name, code, signal });
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
      const ms_timeout = timeout * 1000;
      if (!inspect_lambda) {
        timeout_timer = setTimeout(() => {
          log.warn({ name, ms_timeout });
          kill('SIGKILL');
          callback(JSON.stringify({ code: 'E_TIMEOUT' }));
        }, ms_timeout);
      }
      const fn = (err, value) => {
        clearTimeout(timeout_timer);
        const response = formatJson(err || value);
        log.output({ name, id, response });
        callback(err, value);
      };
      fn.started = Date.now();
      rpcs[++id] = fn;
      const log_event = formatJson(event);
      log.input({ name, id, event: log_event });
      proc.send({ id, event, context });
    }
  };
}

function killHandler(entries, index, name) {
  return () => {
    log.terminate({ name });
    entries.splice(index, 1);
  };
}

function forkPool(base_dir, lambda_path_tpl, config_file_tpl, name,
     default_env, timeout, max_idle) {
  const config = lambdaConfig(base_dir, config_file_tpl, name, default_env);
  const entries = [];
  return {
    invoke(event, context, callback) {
      let entry = entries.find(entry => entry.active === false);
      if (!entry) {
        log.launch({ name });
        const lambda = forkLambda(
          base_dir,
          lambda_path_tpl,
          name,
          config.environment,
          config.timeout || timeout,
          max_idle,
          killHandler(entries, entries.length, name)
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
  const base_dir = options.base_dir || process.cwd();
  const default_env = options.env || {};
  const max_idle = options.max_idle || 60 * 60 * 1000;
  const timeout = options.timeout || 5;
  const lambdas = {};

  const lambda_inspect = process.env.STUDIO_LAMBDA_INSPECT;
  if (lambda_inspect) {
    log.wtf('Lamdba inspection enabled', { name: lambda_inspect });
  }

  return {
    invoke(name, event, context, callback) {
      if (typeof context === 'function') {
        callback = context;
        context = {};
      }
      const lambda = lambdas[name] || (lambdas[name] = forkPool(
        base_dir,
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
