'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const fs = require('fs');
const path = require('path');
const { assert, match, sinon } = require('@sinonjs/referee-sinon');
const logger = require('@studio/log');
const Lambda = require('..');

const log = logger('Lambda');

describe('lambda', () => {
  let lambda;

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  afterEach(() => {
    sinon.restore();
    lambda.shutdown();
  });

  it('invokes lambda with event', (done) => {
    lambda = Lambda.create();

    lambda.invoke('hello', { name: 'JavaScript Studio' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('invokes async lambda', (done) => {
    lambda = Lambda.create();

    lambda.invoke(
      'hello-async',
      { name: 'JavaScript Studio' },
      (err, value) => {
        assert.isNull(err);
        assert.equals(value, 'Hello JavaScript Studio');
        done();
      }
    );
  });

  it('resolves promise if no callback is given', async () => {
    lambda = Lambda.create();

    const promise = lambda.invoke('hello-async', {
      name: 'JavaScript Studio'
    });

    await assert.resolves(promise, 'Hello JavaScript Studio');
  });

  function hasExpectedErrorMessage(err) {
    return err.message.startsWith(
      'Lambda invalid-response message parse error'
    );
  }

  it('handles invalid response', (done) => {
    lambda = Lambda.create();

    lambda.invoke('invalid-response', {}, (err) => {
      assert.equals(err.name, 'Error');
      assert.isTrue(hasExpectedErrorMessage(err));
      done();
    });
  });

  it('rejects promise if no callback is given', async () => {
    lambda = Lambda.create();

    const promise = lambda.invoke('invalid-response');

    await assert.rejects(promise, match(hasExpectedErrorMessage));
  });

  it('handles invalid JSON', (done) => {
    lambda = Lambda.create();

    lambda.invoke('invalid-json', {}, (err) => {
      assert.equals(err.name, 'Error');
      assert.equals(err.message, 'Ouch!');
      assert.match(err.stack, 'Error: Ouch!\n    at ');
      done();
    });
  });

  it('invokes lambda with default context', (done) => {
    sinon.useFakeTimers(123);
    lambda = Lambda.create();

    lambda.invoke('context', {}, (err, value) => {
      assert.isNull(err);
      assert.json(value, {
        functionName: 'context',
        memoryLimitInMB: 128,
        awsRequestId: '000000123_context_1',
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:0000:function:context'
      });
      done();
    });
  });

  it('uses AWS_REGION environment variable in function ARN', (done) => {
    lambda = Lambda.create({
      env: {
        AWS_REGION: 'eu-central-1'
      }
    });

    lambda.invoke('context', {}, (err, value) => {
      assert.isNull(err);
      assert.matchJson(value, {
        invokedFunctionArn: 'arn:aws:lambda:eu-central-1:0000:function:context'
      });
      done();
    });
  });

  it('uses STUDIO_AWS_ACCOUNT environment variable in function ARN', (done) => {
    lambda = Lambda.create({
      env: {
        STUDIO_AWS_ACCOUNT: '12345678'
      }
    });

    lambda.invoke('context', {}, (err, value) => {
      assert.isNull(err);
      assert.matchJson(value, {
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:12345678:function:context'
      });
      done();
    });
  });

  it('invokes lambda with given awsRequestId', (done) => {
    lambda = Lambda.create();

    lambda.invoke('context', {}, { awsRequestId: '666' }, (err, value) => {
      assert.isNull(err);
      assert.matchJson(value, {
        awsRequestId: '666',
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:0000:function:context'
      });
      done();
    });
  });

  it('implements getRemainingTimeInMillis() (default timeout)', (done) => {
    lambda = Lambda.create();

    lambda.invoke('getRemainingTimeInMillis', {}, (err, value) => {
      assert.isNull(err);
      assert.greater(value, 4950);
      assert.less(value, 5000);
      done();
    });
  });

  it('implements getRemainingTimeInMillis() (configured timeout)', (done) => {
    lambda = Lambda.create({
      timeout: 1
    });

    lambda.invoke('getRemainingTimeInMillis', {}, (err, value) => {
      assert.isNull(err);
      assert.greater(value, 950);
      assert.less(value, 1050);
      done();
    });
  });

  it('invokes lambda with environment variables from options', (done) => {
    lambda = Lambda.create({
      env: {
        STUDIO_ENV_VAR: 'JavaScript Studio'
      }
    });

    lambda.invoke('env', { env: 'STUDIO_ENV_VAR' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('passes AWS_PROFILE to lambda', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_PROFILE' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello studio-lambda-test');
      done();
    });
  });

  it('defaults AWS_REGION to us-east-1', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_REGION' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello us-east-1');
      done();
    });
  });

  it('passes AWS_REGION to lambda', (done) => {
    process.env.AWS_REGION = 'eu-central-1';
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_REGION' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello eu-central-1');
      delete process.env.AWS_REGION;
      done();
    });
  });

  it('defaults AWS_DEFAULT_REGION to us-east-1', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_DEFAULT_REGION' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello us-east-1');
      done();
    });
  });

  it('set AWS_DEFAULT_REGION to AWS_REGION', (done) => {
    process.env.AWS_REGION = 'eu-central-1';
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_DEFAULT_REGION' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello eu-central-1');
      delete process.env.AWS_REGION;
      done();
    });
  });

  it('sets LAMBDA_TASK_ROOT to lambda source dir', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'LAMBDA_TASK_ROOT' }, (err, value) => {
      assert.isNull(err);
      assert.equals(
        value,
        `Hello ${path.resolve(__dirname, 'fixture/functions/env')}`
      );
      done();
    });
  });

  it('sets AWS_EXECUTION_ENV to AWS_Lambda_nodejs6.10', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_EXECUTION_ENV' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello AWS_Lambda_nodejs6.10');
      done();
    });
  });

  it('sets AWS_LAMBDA_FUNCTION_NAME to lambda name', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'AWS_LAMBDA_FUNCTION_NAME' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello env');
      done();
    });
  });

  it('sets AWS_LAMBDA_FUNCTION_MEMORY_SIZE to lambda name', (done) => {
    lambda = Lambda.create();

    lambda.invoke(
      'env',
      { env: 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE' },
      (err, value) => {
        assert.isNull(err);
        assert.equals(value, 'Hello 128');
        done();
      }
    );
  });

  it('sets AWS_LAMBDA_FUNCTION_VERSION to 1', (done) => {
    lambda = Lambda.create();

    lambda.invoke(
      'env',
      { env: 'AWS_LAMBDA_FUNCTION_VERSION' },
      (err, value) => {
        assert.isNull(err);
        assert.equals(value, 'Hello 1');
        done();
      }
    );
  });

  it('sets LANG to en_US.UTF-8', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'LANG' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello en_US.UTF-8');
      done();
    });
  });

  it('sets PATH to /usr/local/bin', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'PATH' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello /usr/local/bin');
      done();
    });
  });

  it('sets TZ to UTC', (done) => {
    lambda = Lambda.create();

    lambda.invoke('env', { env: 'TZ' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Hello UTC');
      done();
    });
  });

  it('invokes lambda with environment variables from file', (done) => {
    process.env.STUDIO_ENVIRONMENT_VARIABLE = 'JavaScript Studio';
    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda.invoke('env-file', {}, (err, value) => {
      delete process.env.STUDIO_ENVIRONMENT_VARIABLE;
      assert.isNull(err);
      assert.equals(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('fails to launch lambda if environment variable is missing', (done) => {
    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda.invoke('env-file', {}, (err) => {
      assert.json(err, {
        message: 'Failed to launch "env-file"'
      });
      done();
    });
  });

  it('fails to launch async lambda if environment variable is missing', async () => {
    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    const promise = lambda.invoke('env-file-async');

    await assert.rejects(
      promise,
      match.json({
        message: 'Failed to launch "env-file-async"'
      })
    );
  });

  it('invokes lambda with DEBUG environment variables', (done) => {
    process.env.DEBUG = 'ON';

    lambda = Lambda.create({});

    lambda.invoke('debug', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Debug ON');
      done();
    });
  });

  it('reuses lambda process', (done) => {
    lambda = Lambda.create();

    lambda.invoke('reuse', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Count 1');
      // eslint-disable-next-line no-shadow
      lambda.invoke('reuse', {}, (err, value) => {
        assert.isNull(err);
        assert.equals(value, 'Count 2');
        done();
      });
    });
  });

  it('runs lambda concurrently', (done) => {
    lambda = Lambda.create();
    let invokes = 0;

    lambda.invoke('concurrent', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Count 1');
      if (++invokes === 2) {
        done();
      }
    });
    lambda.invoke('concurrent', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Count 1');
      if (++invokes === 2) {
        done();
      }
    });
  });

  it('shuts down lambda after max_idle', (done) => {
    lambda = Lambda.create({
      max_idle: 200
    });

    lambda.invoke('reuse', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Count 1');
      setTimeout(() => {
        // eslint-disable-next-line no-shadow
        lambda.invoke('reuse', {}, (err, value) => {
          assert.isNull(err);
          assert.equals(value, 'Count 1');
          done();
        });
      }, 201);
    });
  });

  it('kills lambda after default timeout', (done) => {
    sinon.stub(log, 'warn');

    lambda = Lambda.create({
      timeout: 0.1
    });

    lambda.invoke('timeout', {}, (err) => {
      assert.json(err, { code: 'E_TIMEOUT' });
      assert.calledOnce(log.warn);
      done();
    });
  });

  it('kills lambda after configured timeout', (done) => {
    sinon.stub(log, 'warn');

    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda.invoke('timeout-file', {}, (err) => {
      assert.json(err, { code: 'E_TIMEOUT' });
      assert.calledOnce(log.warn);
      done();
    });
  });

  it('does not fail to talk to lambda after two where killed', (done) => {
    sinon.stub(log, 'warn');

    lambda = Lambda.create({
      timeout: 0.1
    });

    lambda.invoke('timeout', {}, (err) => {
      assert.json(err, { code: 'E_TIMEOUT' });
    });
    lambda.invoke('timeout', {}, (err) => {
      assert.json(err, { code: 'E_TIMEOUT' });
      // eslint-disable-next-line no-shadow
      lambda.invoke('timeout', {}, (err) => {
        assert.json(err, { code: 'E_TIMEOUT' });
        done();
      });
    });
  });

  it('uses given base_dir', (done) => {
    lambda = Lambda.create({
      base_dir: `${__dirname}/fixture/cwd`
    });

    lambda.invoke('hello', { name: 'works' }, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Other dir works');
      done();
    });
  });

  it('handles log output', (done) => {
    const lambda_log = logger('Lambda log');
    const lambda_test_log = logger('Lambda log Test');
    lambda = Lambda.create();
    sinon.stub(lambda_log, 'ignore');
    sinon.stub(lambda_test_log, 'ok');
    sinon.stub(lambda_test_log, 'warn');
    sinon.stub(lambda_test_log, 'error');
    sinon.stub(lambda_test_log, 'wtf');

    lambda.invoke('log', { is: 42 }, (err) => {
      assert.isNull(err);
      assert.calledOnceWith(lambda_log.ignore, 'Raw log line');
      assert.calledOnceWith(lambda_test_log.ok, 'Check');
      assert.calledOnceWith(lambda_test_log.warn, { event: { is: 42 } });
      assert.calledOnceWith(
        lambda_test_log.error,
        { event: { is: 42 } },
        match({ stack: match.string })
      );
      assert.calledOnce(lambda_test_log.wtf);
      assert.calledWithExactly(lambda_test_log.wtf);
      done();
    });
  });

  it('handles error log output with cause', (done) => {
    const lambda_test_log = logger('Lambda log-error-cause Test');
    lambda = Lambda.create();
    sinon.stub(lambda_test_log, 'error');

    lambda.invoke('log-error-cause', {}, (err) => {
      assert.isNull(err);
      assert.calledOnceWith(
        lambda_test_log.error,
        'Failure',
        match({
          stack: match('Fail'),
          cause: match('Cause')
        })
      );
      done();
    });
  });

  it('handles invalid log output', (done) => {
    const lambda_log = logger('Lambda invalid-log');
    sinon.stub(lambda_log, 'error');

    lambda = Lambda.create();

    lambda.invoke('invalid-log', {}, (err) => {
      assert.isNull(err);

      assert.calledOnceWith(
        lambda_log.error,
        {
          line: '{"some":"incomplete json output'
        },
        match.instanceOf(SyntaxError)
      );
      done();
    });
  });

  it('handles throwing lambda', (done) => {
    sinon.stub(process.stderr, 'write');

    lambda = Lambda.create();

    lambda.invoke('throw', {}, (err) => {
      assert.json(err, { code: 'ERR_FAILED' });
      done();
    });
  });

  it('handles throwing async lambda', (done) => {
    sinon.stub(process.stderr, 'write');

    lambda = Lambda.create();

    lambda.invoke('throw-async', {}, (err) => {
      assert.json(err, { code: 'ERR_FAILED' });
      done();
    });
  });

  it('runs node process with default memory', (done) => {
    lambda = Lambda.create({});

    lambda.invoke('memory', {}, (err, value) => {
      assert.isNull(err);
      assert.equals(value, 'Allocated');
      done();
    });
  });

  context('with memory limit', () => {
    after(() => {
      // Remove the node memory report.
      const dir = `${__dirname}/fixture/functions/memory`;
      // eslint-disable-next-line node/no-sync
      fs.readdirSync(dir)
        .filter((file) => file.startsWith('report.'))
        .forEach((file) => {
          // eslint-disable-next-line node/no-sync
          fs.unlinkSync(`${dir}/${file}`);
        });
    });

    it('runs node process with memory from config file', (done) => {
      sinon.stub(process.stderr, 'write');

      lambda = Lambda.create({
        env: {
          AWS_PROFILE: 'local'
        }
      });

      lambda.invoke('memory', {}, (err) => {
        assert.json(err, { code: 'ERR_FAILED' });
        done();
      });
    });

    it('runs node process with memory from property', (done) => {
      sinon.stub(process.stderr, 'write');

      lambda = Lambda.create({
        memory: 8
      });

      lambda.invoke('memory', {}, (err) => {
        assert.json(err, { code: 'ERR_FAILED' });
        done();
      });
    });
  });
});
