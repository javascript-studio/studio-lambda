/*eslint-env mocha*/
'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const assert = require('assert');
const sinon = require('sinon');
const logger = require('@studio/log');
const Lambda = require('..');

const log = logger('Lambda');

describe('lambda', () => {
  const sandbox = sinon.createSandbox();
  let lambda;

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  afterEach(() => {
    sandbox.restore();
    lambda.shutdown();
  });

  it('invokes lambda with event', (done) => {
    lambda = Lambda.create();

    lambda.invoke('hello', { name: 'JavaScript Studio' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('handles invalid response', (done) => {
    lambda = Lambda.create();

    lambda.invoke('invalid-response', {}, (err) => {
      assert.equal(err.name, 'Error');
      assert.equal(err.message.startsWith(
        'Lambda invalid-response message parse error'), true);
      done();
    });
  });

  it('invokes lambda with default context', (done) => {
    sandbox.useFakeTimers(123);
    lambda = Lambda.create();

    lambda.invoke('context', {}, (err, value) => {
      assert.equal(err, null);
      const res = JSON.parse(value);
      assert.equal(res.functionName, 'context');
      assert.equal(res.memoryLimitInMB, 128);
      assert.equal(res.awsRequestId, '000000123_context_1');
      assert.equal(res.invokedFunctionArn,
        'arn:aws:lambda:us-east-1:0000:function:context');
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
      assert.equal(err, null);
      const res = JSON.parse(value);
      assert.equal(res.invokedFunctionArn,
        'arn:aws:lambda:eu-central-1:0000:function:context');
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
      assert.equal(err, null);
      const res = JSON.parse(value);
      assert.equal(res.invokedFunctionArn,
        'arn:aws:lambda:us-east-1:12345678:function:context');
      done();
    });
  });

  it('invokes lambda with given awsRequestId', (done) => {
    lambda = Lambda.create();

    lambda.invoke('context', {}, { awsRequestId: '666' }, (err, value) => {
      assert.equal(err, null);
      const res = JSON.parse(value);
      assert.equal(res.awsRequestId, '666');
      assert.equal(res.invokedFunctionArn,
        'arn:aws:lambda:us-east-1:0000:function:context');
      done();
    });
  });

  it('implements getRemainingTimeInMillis() (default timeout)', (done) => {
    lambda = Lambda.create();

    lambda.invoke('getRemainingTimeInMillis', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value > 4950, true);
      assert.equal(value < 5000, true);
      done();
    });
  });

  it('implements getRemainingTimeInMillis() (configured timeout)', (done) => {
    lambda = Lambda.create({
      timeout: 1
    });

    lambda.invoke('getRemainingTimeInMillis', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value > 950, true);
      assert.equal(value < 1050, true);
      done();
    });
  });

  it('invokes lambda with environment variables from options', (done) => {
    lambda = Lambda.create({
      env: {
        STUDIO_ENV_VAR: 'JavaScript Studio'
      }
    });

    lambda.invoke('env', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
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
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
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
      assert.equal(err, JSON.stringify({
        message: 'Failed to launch "env-file"'
      }));
      done();
    });
  });

  it('invokes lambda with DEBUG environment variables', (done) => {
    process.env.DEBUG = 'ON';

    lambda = Lambda.create({});

    lambda.invoke('debug', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Debug ON');
      done();
    });
  });

  it('reuses lambda process', (done) => {
    lambda = Lambda.create();

    lambda.invoke('reuse', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      lambda.invoke('reuse', {}, (err, value) => {
        assert.equal(err, null);
        assert.equal(value, 'Count 2');
        done();
      });
    });
  });

  it('runs lambda concurrently', (done) => {
    lambda = Lambda.create();
    let invokes = 0;

    lambda.invoke('concurrent', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      if (++invokes === 2) {
        done();
      }
    });
    lambda.invoke('concurrent', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
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
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      setTimeout(() => {
        lambda.invoke('reuse', {}, (err, value) => {
          assert.equal(err, null);
          assert.equal(value, 'Count 1');
          done();
        });
      }, 201);
    });
  });

  it('kills lambda after default timeout', (done) => {
    sandbox.stub(log, 'warn');

    lambda = Lambda.create({
      timeout: 0.1
    });

    lambda.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      sinon.assert.calledOnce(log.warn);
      done();
    });
  });

  it('kills lambda after configured timeout', (done) => {
    sandbox.stub(log, 'warn');

    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda.invoke('timeout-file', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      sinon.assert.calledOnce(log.warn);
      done();
    });
  });

  it('does not fail to talk to lambda after two where killed', (done) => {
    sandbox.stub(log, 'warn');

    lambda = Lambda.create({
      timeout: 0.1
    });

    lambda.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
    });
    lambda.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      lambda.invoke('timeout', {}, (err) => {
        assert.equal(err, '{"code":"E_TIMEOUT"}');
        done();
      });
    });
  });

  it('uses given base_dir', (done) => {
    lambda = Lambda.create({
      base_dir: `${__dirname}/fixture/cwd`
    });

    lambda.invoke('hello', { name: 'works' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Other dir works');
      done();
    });
  });

  it('handles log output', (done) => {
    const lambda_log = logger('Lambda log');
    const lambda_test_log = logger('Lambda log Test');
    lambda = Lambda.create();
    sandbox.stub(lambda_log, 'ignore');
    sandbox.stub(lambda_test_log, 'ok');
    sandbox.stub(lambda_test_log, 'warn');
    sandbox.stub(lambda_test_log, 'error');
    sandbox.stub(lambda_test_log, 'wtf');

    lambda.invoke('log', { is: 42 }, (err) => {
      assert.ifError(err);
      sinon.assert.calledOnce(lambda_log.ignore);
      sinon.assert.calledWith(lambda_log.ignore, 'Raw log line');
      sinon.assert.calledOnce(lambda_test_log.ok);
      sinon.assert.calledWith(lambda_test_log.ok, 'Check');
      sinon.assert.calledOnce(lambda_test_log.warn);
      sinon.assert.calledWith(lambda_test_log.warn, { event: { is: 42 } });
      sinon.assert.calledOnce(lambda_test_log.error);
      sinon.assert.calledWith(lambda_test_log.error, { event: { is: 42 } },
        sinon.match.string);
      sinon.assert.calledOnce(lambda_test_log.wtf);
      sinon.assert.calledWithExactly(lambda_test_log.wtf);
      done();
    });
  });

  it('handles invalid log output', (done) => {
    const lambda_log = logger('Lambda invalid-log');
    sandbox.stub(lambda_log, 'error');

    lambda = Lambda.create();

    lambda.invoke('invalid-log', {}, (err) => {
      assert.equal(err, null);

      sinon.assert.calledOnce(lambda_log.error);
      sinon.assert.calledWith(lambda_log.error, {
        line: '{"some":"incomplete json output'
      }, sinon.match.instanceOf(SyntaxError));
      done();
    });
  });

  it('handled dying lambda', (done) => {
    sandbox.stub(process.stderr, 'write');

    lambda = Lambda.create();

    lambda.invoke('throw', {}, (err) => {
      assert.equal(err, '{"code":"ERR_FAILED"}');
      done();
    });
  });

  it('runs node process with default memory', (done) => {
    lambda = Lambda.create({});

    lambda.invoke('memory', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Allocated');
      done();
    });
  });

  it('runs node process with memory from config file', (done) => {
    sandbox.stub(process.stderr, 'write');

    lambda = Lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda.invoke('memory', {}, (err) => {
      assert.equal(err, '{"code":"ERR_FAILED"}');
      done();
    });
  });

  it('runs node process with memory from property', (done) => {
    sandbox.stub(process.stderr, 'write');

    lambda = Lambda.create({
      memory: 16
    });

    lambda.invoke('memory', {}, (err) => {
      assert.equal(err, '{"code":"ERR_FAILED"}');
      done();
    });
  });

});
