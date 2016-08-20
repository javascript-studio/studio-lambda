/*eslint-env mocha*/
'use strict';

const assert = require('assert');
const lambda = require('..');


describe('lambda', () => {

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  it('invokes lambda with event', (done) => {
    const lambda_ctrl = lambda.create();

    lambda_ctrl.invoke('hello', { name: 'JavaScript Studio' }, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
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
    const lambda_ctrl = lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda_ctrl.invoke('env-file', {}, (err, value) => {
      assert.equal(err, null);
      assert.equal(value, 'Hello JavaScript Studio');
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
    const lambda_ctrl = lambda.create({
      timeout: 100
    });

    lambda_ctrl.invoke('timeout', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      done();
    });
  });

  it('kills lambda after configured timeout', (done) => {
    const lambda_ctrl = lambda.create({
      env: {
        AWS_PROFILE: 'local'
      }
    });

    lambda_ctrl.invoke('timeout-file', {}, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');
      done();
    });
  });

});
