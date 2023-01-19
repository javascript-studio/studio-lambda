/*
 * Copyright (c) Maximilian Antoni <max@javascript.studio>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const fork = require('child_process').fork;
const { Writable } = require('stream');
const logger = require('@studio/log');
const ParseTransform = require('@studio/ndjson/parse');

const DEFAULT_LAMBDA_TIMEOUT = 5;
const DEFAULT_LAMBDA_MEMORY = 128;
const DEFAULT_LAMBDA_MAX_IDLE = 60 * 60 * 1000;
const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_AWS_ACCOUNT = '000000000000';

const log = logger('Lambda');

function replaceVars(str, lookup) {
  return str.replace(/\${([A-Z_]+)}/g, (m, v) => {
    const value = lookup(v);
    if (value) {
      return value;
    }
    throw new Error(`Missing variable ${v}`);
  });
}

function lambdaConfig(base_dir, config_file_tpl, name, default_env) {
  const vars = {
    LAMBDA_NAME: name
  };
  let config_file = replaceVars(
    config_file_tpl,
    (v) => vars[v] || default_env[v] || process.env[v]
  );
  let str = '{}';
  try {
    // eslint-disable-next-line n/no-sync
    str = fs.readFileSync(path.join(base_dir, config_file), 'utf8');
  } catch (e) {
    // File not found
    config_file = '<defaults>';
  }
  log.disk({ name, config_file });
  const config = JSON.parse(replaceVars(str, (v) => process.env[v]));
  config.environment = Object.assign({}, config.environment || {}, default_env);
  return config;
}

function looseOutputLogger(lambda_log) {
  let buf = '';
  return new Writable({
    write(chunk, enc, callback) {
      buf += chunk;
      let p = buf.indexOf('\n');
      while (p !== -1) {
        lambda_log.ignore(buf.substring(0, p));
        buf = buf.substring(p + 1);
        p = buf.indexOf('\n');
      }
      callback();
    }
  });
}

/*
 * Lambda environment variables:
 * https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
 */
function forkLambda(
  base_dir,
  lambda_path_tpl,
  name,
  environment,
  timeout,
  memoryLimitInMB,
  max_idle,
  onKill
) {
  // eslint-disable-next-line no-template-curly-in-string
  const lambda_path = lambda_path_tpl.replace('${LAMBDA_NAME}', name);
  const lambda_file = path.basename(lambda_path);
  const cwd = path.join(base_dir, path.dirname(lambda_path));
  const env = Object.assign(
    {
      HOME: process.env.HOME, // Required for aws-sdk to find the credentials
      LANG: 'en_US.UTF-8',
      PATH: '/usr/local/bin',
      TZ: 'UTC',
      LAMBDA_TASK_ROOT: cwd,
      AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs6.10',
      AWS_PROFILE: process.env.AWS_PROFILE,
      AWS_REGION: process.env.AWS_REGION || DEFAULT_AWS_REGION,
      AWS_DEFAULT_REGION: process.env.AWS_REGION || DEFAULT_AWS_REGION,
      AWS_LAMBDA_FUNCTION_NAME: name,
      AWS_LAMBDA_FUNCTION_MEMORY_SIZE: memoryLimitInMB,
      AWS_LAMBDA_FUNCTION_VERSION: '1',
      NODE_TLS_REJECT_UNAUTHORIZED: '0'
    },
    environment
  );
  if (process.env.DEBUG) {
    env.DEBUG = process.env.DEBUG;
  }

  const inspect_lambda = process.env.STUDIO_LAMBDA_INSPECT === name;
  const execArgv = process.execArgv.slice();
  execArgv.push(`--max-old-space-size=${memoryLimitInMB}`);
  if (inspect_lambda) {
    execArgv.push('--inspect');
  }
  const proc = fork(path.join(__dirname, 'runner.js'), [lambda_file], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    execArgv
  });
  const rpcs = {};
  const destroy = () => {
    Object.keys(rpcs).forEach((id) => {
      const fn = rpcs[id];
      delete rpcs[id];
      if (fn) {
        fn(JSON.stringify({ code: 'ERR_FAILED' }));
      }
    });
    if (onKill) {
      onKill();
      onKill = null;
    }
  };
  const lambda_log = logger(`Lambda ${name}`);
  proc.stderr.on('data', (data) => {
    // Using a pipe and forwarding "manually" to mute the stream during tests.
    process.stderr.write(data);
  });
  const transform = new ParseTransform({
    loose_out: looseOutputLogger(lambda_log)
  });
  transform.on('error', (e) => {
    if (e.code === 'ERR_JSON_PARSE') {
      lambda_log.error({ line: e.line }, e);
    } else {
      lambda_log.error(e);
    }
  });
  proc.stdout.pipe(transform).pipe(
    new Writable({
      objectMode: true,
      write(json, enc, callback) {
        const args = [];
        if (json.msg) {
          args.push(json.msg);
        }
        if (json.data) {
          args.push(json.data);
        }
        if (json.stack) {
          const err = { stack: json.stack };
          if (json.cause) {
            err.cause = json.cause;
          }
          args.push(err);
        }
        lambda_log.child(json.ns)[json.topic](...args);
        callback();
      }
    })
  );
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
      fn(m.err || null, res);
    }
  });
  let timeout_timer;
  let idle_timer;
  function clearTimers() {
    if (idle_timer) {
      clearTimeout(idle_timer);
      idle_timer = null;
    }
    if (timeout_timer) {
      clearTimeout(timeout_timer);
      timeout_timer = null;
    }
  }
  proc.on('error', (err) => {
    log.error({ name }, err);
    clearTimers();
    destroy();
  });
  proc.on('exit', (code, signal) => {
    if (code) {
      log.error({ name, code, signal });
    }
    clearTimers();
    destroy();
  });
  function kill(signal = 'SIGTERM') {
    clearTimers();
    proc.kill(signal);
    if (onKill) {
      onKill();
      onKill = null;
    }
  }
  let id = 0;
  let graceful_shutdown = false;
  return {
    invoke(event, context, callback) {
      if (idle_timer) {
        clearTimeout(idle_timer);
      }
      idle_timer = setTimeout(kill, max_idle);
      const i = ++id;
      const ms_timeout = timeout * 1000;
      if (!inspect_lambda) {
        timeout_timer = setTimeout(() => {
          log.warn({ name, ms_timeout });
          delete rpcs[i];
          kill('SIGKILL');
          callback(JSON.stringify({ code: 'E_TIMEOUT' }));
        }, ms_timeout);
      }
      const fn = (err, value) => {
        clearTimeout(timeout_timer);
        if (graceful_shutdown) {
          kill();
        }
        callback(err, value);
      };
      fn.started = Date.now();
      rpcs[i] = fn;
      proc.send({ id: i, event, context });
    },
    shutdown(options) {
      if (options && options.graceful) {
        graceful_shutdown = true;
      } else {
        kill();
      }
    }
  };
}

function killHandler(entries, id, name) {
  return () => {
    log.terminate({ name });
    const index = entries.findIndex((entry) => entry.id === id);
    if (index !== -1) {
      entries.splice(index, 1);
    }
  };
}

function now() {
  return new Date()
    .toISOString()
    .split('T')[1]
    .replace(/[Z.\-:]/g, '');
}

function forkPool(
  base_dir,
  lambda_path_tpl,
  config_file_tpl,
  name,
  base_options
) {
  const env = base_options.env || {};
  const config = lambdaConfig(base_dir, config_file_tpl, name, env);
  const timeout =
    config.timeout || base_options.timeout || DEFAULT_LAMBDA_TIMEOUT;
  const memory = config.memory || base_options.memory || DEFAULT_LAMBDA_MEMORY;
  const entries = [];
  let forks = 0;
  let request_id = 0;
  return {
    invoke(event, options, callback) {
      // eslint-disable-next-line no-shadow
      let entry = entries.find((entry) => entry.active === false);
      if (!entry) {
        log.spawn({ name, timeout, memory });
        const id = ++forks;
        const lambda = forkLambda(
          base_dir,
          lambda_path_tpl,
          name,
          config.environment,
          timeout,
          memory,
          base_options.max_idle || DEFAULT_LAMBDA_MAX_IDLE,
          killHandler(entries, id, name)
        );
        entry = {
          lambda,
          id,
          active: false
        };
        entries.push(entry);
      }
      const context = {
        timeout,
        functionName: name,
        memoryLimitInMB: memory,
        invokedFunctionArn: invokedFunctionArn(name),
        awsRequestId: options.awsRequestId || `${now()}_${name}_${++request_id}`
      };
      entry.active = true;
      entry.lambda.invoke(event, context, (err, value) => {
        entry.active = false;
        callback(err, value);
      });
    },
    shutdown(options) {
      entries.slice().forEach((entry) => entry.lambda.shutdown(options));
    },
    stats() {
      return {
        instances: entries.length,
        requests: request_id,
        active: entries.filter((entry) => entry.active).length
      };
    }
  };
}

function invokedFunctionArn(function_name) {
  const region = process.env.AWS_REGION || DEFAULT_AWS_REGION;
  const account = process.env.STUDIO_AWS_ACCOUNT || DEFAULT_AWS_ACCOUNT;
  return `arn:aws:lambda:${region}:${account}:function:${function_name}`;
}

exports.create = function (base_options = {}) {
  const lambda_path_tpl =
    base_options.lambda_path ||
    // eslint-disable-next-line no-template-curly-in-string
    'functions/${LAMBDA_NAME}/index.js';
  const config_file_tpl =
    base_options.config_file ||
    // eslint-disable-next-line no-template-curly-in-string
    'functions/${LAMBDA_NAME}/function.${AWS_PROFILE}.json';
  const base_dir = base_options.base_dir || process.cwd();
  const lambdas = {};

  const lambda_inspect = process.env.STUDIO_LAMBDA_INSPECT;
  if (lambda_inspect) {
    log.wtf('Lamdba inspection enabled', { name: lambda_inspect });
  }

  return {
    invoke(name, event, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (!options) {
        options = {};
      }
      let lambda = lambdas[name];
      if (!lambda) {
        try {
          lambda = lambdas[name] = forkPool(
            base_dir,
            lambda_path_tpl,
            config_file_tpl,
            name,
            base_options
          );
        } catch (e) {
          log.error('Failed to launch Lambda', { name, base_dir }, e);
          const message = `{"message":"Failed to launch \\"${name}\\""}`;
          if (callback) {
            callback(message);
            return;
          }
          // eslint-disable-next-line consistent-return
          return Promise.reject(message);
        }
      }
      if (!callback) {
        // eslint-disable-next-line consistent-return
        return util.promisify(lambda.invoke)(event, options);
      }
      lambda.invoke(event, options, callback);
    },
    shutdown(options) {
      Object.keys(lambdas).forEach((name) => lambdas[name].shutdown(options));
    },
    stats() {
      const stats = {};
      Object.keys(lambdas).forEach((name) => {
        stats[name] = lambdas[name].stats();
      });
      return stats;
    }
  };
};
