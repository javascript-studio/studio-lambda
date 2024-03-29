'use strict';

process.env.AWS_PROFILE = 'studio-lambda-test';

const { assert } = require('@sinonjs/referee-sinon');
const Lambda = require('..');

describe('stats', () => {
  let lambda;

  before(() => {
    process.chdir(`${__dirname}/fixture`);
  });

  beforeEach(() => {
    lambda = Lambda.create();
  });

  afterEach(() => {
    lambda.shutdown();
  });

  it('counts first instance and request', (done) => {
    lambda.invoke('hello', { name: 'Stats' }, () => {
      const stats = lambda.stats();

      assert.isObject(stats.hello);
      assert.equals(stats.hello.instances, 1);
      assert.equals(stats.hello.requests, 1);
      assert.equals(stats.hello.active, 0);
      done();
    });
  });

  it('counts sequential requests', (done) => {
    lambda.invoke('hello', { name: 'A' }, () => {
      lambda.invoke('hello', { name: 'B' }, () => {
        const stats = lambda.stats();

        assert.isObject(stats.hello);
        assert.equals(stats.hello.instances, 1);
        assert.equals(stats.hello.requests, 2);
        assert.equals(stats.hello.active, 0);
        done();
      });
    });
  });

  it('counts concurrent requests', (done) => {
    let count = 2;
    const latch = () => {
      if (--count === 0) {
        const stats = lambda.stats();

        assert.isObject(stats.hello);
        assert.equals(stats.hello.instances, 2);
        assert.equals(stats.hello.requests, 2);
        assert.equals(stats.hello.active, 0);
        done();
      }
    };
    lambda.invoke('hello', { name: 'A' }, latch);
    lambda.invoke('hello', { name: 'B' }, latch);
  });

  it('counts active instances', (done) => {
    lambda.invoke('hello', {}, () => {});
    lambda.invoke('hello', {}, () => {});

    const stats = lambda.stats();

    assert.isObject(stats.hello);
    assert.equals(stats.hello.instances, 2);
    assert.equals(stats.hello.requests, 2);
    assert.equals(stats.hello.active, 2);
    done();
  });
});
