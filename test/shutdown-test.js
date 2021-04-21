'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const { assert } = require('@sinonjs/referee-sinon');
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

      assert.isObject(stats.hello);
      assert.equals(stats.hello.instances, 0);
      assert.equals(stats.hello.requests, 1);
      assert.equals(stats.hello.active, 0);
      done();
    });
  });

  it('fails pending instance', (done) => {
    const lambda = Lambda.create();
    lambda.invoke('hello', { name: 'X' }, (err) => {
      assert.json(err, { code: 'ERR_FAILED' });

      const stats = lambda.stats();

      assert.isObject(stats.hello);
      assert.equals(stats.hello.instances, 0);
      assert.equals(stats.hello.requests, 1);
      assert.equals(stats.hello.active, 0);
      done();
    });

    lambda.shutdown();
  });

  it('waits for pending instance if graceful options is true', (done) => {
    const lambda = Lambda.create();
    lambda.invoke('hello', { name: 'X' }, (err) => {
      assert.isNull(err);

      const stats = lambda.stats();

      assert.isObject(stats.hello);
      assert.equals(stats.hello.instances, 0);
      assert.equals(stats.hello.requests, 1);
      assert.equals(stats.hello.active, 0);
      done();
    });

    lambda.shutdown({ graceful: true });
  });

  it('waits for timeout instance if graceful options is true', (done) => {
    const lambda = Lambda.create({
      timeout: 0.1
    });
    lambda.invoke('timeout', { name: 'X' }, (err) => {
      assert.json(err, { code: 'E_TIMEOUT' });

      const stats = lambda.stats();

      assert.isObject(stats.timeout);
      assert.equals(stats.timeout.instances, 0);
      assert.equals(stats.timeout.requests, 1);
      assert.equals(stats.timeout.active, 0);
      done();
    });

    lambda.shutdown({ graceful: true });
  });
});
