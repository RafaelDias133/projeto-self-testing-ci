.PHONY: install lint test unit integration e2e coverage start load

install:
	npm ci

lint:
	npm run lint

unit:
	npm run test:unit

integration:
	npm run test:integration

e2e:
	npm run test:e2e

test:
	npm test

coverage:
	npm run test:coverage

start:
	npm start

load:
	npm run load
