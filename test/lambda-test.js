/*eslint-env mocha*/
'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const assert = require('assert');
const sinon = require('sinon');
const logger = require('@studio/log');
const lambda = require('..');

const log = logger('Lambda');

describe('lambda', () => {
  let sandbox;

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('invokes lambda with event', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('hello', { name: 'JavaScript Studio' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('handles invalid response', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('invalid-response', {}, (err) => {
      assert.equal(err.name, 'Error');
      assert.equal(err.message.startsWith(
        'Lambda invalid-response message parse error'), true);
      done();
    });
  });

  it('invokes lambda with default context', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('context', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, '{}');
      done();
    });
  });

  it('invokes lambda with given context', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('context', {}, { some: 'data' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, '{"some":"data"}');
      done();
    });
  });

  it('invokes lambda with environment variables from options', (done) => {
    const lambda_ctrl = lambda.create({
      env: {
        STUDIO_ENV_VAR: 'JavaScript Studio'
      }
    });

    lambda_ctrl.invoke('env', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('invokes lambda with environment variables from file', (done) => {
    process.env.STUDIO_ENVIRONMENT_VARIABLE = 'JavaScript Studio';
    const lambda_ctrl = lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda_ctrl.invoke('env-file', {}, (err, value) => {
      delete process.env.STUDIO_ENVIRONMENT_VARIABLE;
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
      done();
    });
  });

  it('fails to launch lambda if environment variable is missing', (done) => {
    const lambda_ctrl = lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda_ctrl.invoke('env-file', {}, (err) => {
      assert.equal(err, JSON.stringify({
        message: 'Failed to launch "env-file"'
      }));
      done();
    });
  });

  it('invokes lambda with DEBUG environment variables', (done) => {
    process.env.DEBUG = 'ON';

    const lambda_ctrl = lambda.create({});

    lambda_ctrl.invoke('debug', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Debug ON');
      done();
    });
  });

  it('reuses lambda process', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('reuse', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      lambda_ctrl.invoke('reuse', {}, (err, value) => {
        assert.equal(err, null);
        assert.equal(value, 'Count 2');
        done();
      });
    });
  });

  it('runs lambda concurrently', (done) => {
    const lambda_ctrl = lambda.create();
    let invokes = 0;

    lambda_ctrl.invoke('concurrent', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      if (++invokes === 2) {
        done();
      }
    });
    lambda_ctrl.invoke('concurrent', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      if (++invokes === 2) {
        done();
      }
    });
  });

  it('shuts down lambda after max_idle', (done) => {
    const lambda_ctrl = lambda.create({
      max_idle: 200
    });

    lambda_ctrl.invoke('reuse', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Count 1');
      setTimeout(() => {
        lambda_ctrl.invoke('reuse', {}, (err, value) => {
          assert.equal(err, null);
          assert.equal(value, 'Count 1');
          done();
        });
      }, 201);
    });
  });

  it('kills lambda after default timeout', (done) => {
    sandbox.stub(log, 'warn');

    const lambda_ctrl = lambda.create({
      timeout: 0.1
    });

    lambda_ctrl.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      sinon.assert.calledOnce(log.warn);
      done();
    });
  });

  it('kills lambda after configured timeout', (done) => {
    sandbox.stub(log, 'warn');

    const lambda_ctrl = lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda_ctrl.invoke('timeout-file', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      sinon.assert.calledOnce(log.warn);
      done();
    });
  });

  it('does not fail to talk to lambda after two where killed', (done) => {
    sandbox.stub(log, 'warn');

    const lambda_ctrl = lambda.create({
      timeout: 0.1
    });

    lambda_ctrl.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
    });
    lambda_ctrl.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      lambda_ctrl.invoke('timeout', {}, (err) => {
        assert.equal(err, '{"code":"E_TIMEOUT"}');
        done();
      });
    });
  });

  it('uses given base_dir', (done) => {
    const lambda_ctrl = lambda.create({
      base_dir: `${__dirname}/fixture/cwd`
    });

    lambda_ctrl.invoke('hello', { name: 'works' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Other dir works');
      done();
    });
  });

  it('handles log output', (done) => {
    const lambda_log = logger('Lambda log');
    const lambda_test_log = logger('Lambda log Test');
    const lambda_ctrl = lambda.create();
    sandbox.stub(lambda_log, 'ignore');
    sandbox.stub(lambda_test_log, 'ok');
    sandbox.stub(lambda_test_log, 'warn');
    sandbox.stub(lambda_test_log, 'error');
    sandbox.stub(lambda_test_log, 'wtf');

    lambda_ctrl.invoke('log', { is: 42 }, (err) => {
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

});
