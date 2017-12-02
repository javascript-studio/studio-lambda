/*eslint-env mocha*/
'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const assert = require('assert');
const Lambda = require('..');

describe('shutdown', () => {

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  it('removes any running instance', (done) => {
    const lambda = Lambda.create();
    lambda.invoke('hello', { name: 'X' }, () => {

      lambda.shutdown();

      const stats = lambda.stats();

      assert.equal(typeof stats.hello, 'object');
      assert.equal(stats.hello.instances, 0);
      assert.equal(stats.hello.requests, 1);
      assert.equal(stats.hello.active, 0);
      done();
    });
  });

  it('fails pending instance', (done) => {
    const lambda = Lambda.create();
    lambda.invoke('hello', { name: 'X' }, (err) => {
      assert.equal(err, '{"code":"ERR_FAILED"}');

      const stats = lambda.stats();

      assert.equal(typeof stats.hello, 'object');
      assert.equal(stats.hello.instances, 0);
      assert.equal(stats.hello.requests, 1);
      assert.equal(stats.hello.active, 0);
      done();
    });

    lambda.shutdown();
  });

  it('waits for pending instance if graceful options is true', (done) => {
    const lambda = Lambda.create();
    lambda.invoke('hello', { name: 'X' }, (err) => {
      assert.equal(err, null);

      const stats = lambda.stats();

      assert.equal(typeof stats.hello, 'object');
      assert.equal(stats.hello.instances, 0);
      assert.equal(stats.hello.requests, 1);
      assert.equal(stats.hello.active, 0);
      done();
    });

    lambda.shutdown({ graceful: true });
  });

  it('waits for timeout instance if graceful options is true', (done) => {
    const lambda = Lambda.create({
      timeout: 0.1
    });
    lambda.invoke('timeout', { name: 'X' }, (err) => {
      assert.equal(err, '{"code":"E_TIMEOUT"}');

      const stats = lambda.stats();

      assert.equal(typeof stats.timeout, 'object');
      assert.equal(stats.timeout.instances, 0);
      assert.equal(stats.timeout.requests, 1);
      assert.equal(stats.timeout.active, 0);
      done();
    });

    lambda.shutdown({ graceful: true });
  });

});
