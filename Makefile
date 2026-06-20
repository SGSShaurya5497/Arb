.PHONY: dev test lint build

dev:
	docker-compose up

test:
	cd backend && pytest
	cd frontend && npm run test

lint:
	cd backend && flake8 .
	cd backend && black --check .
	cd backend && isort --check-only .

	cd frontend && npm run lint

build:
	docker-compose build
	