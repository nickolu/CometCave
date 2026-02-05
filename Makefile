format:
	npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,scss,md}" --config .prettierrc

lint:
	eslint "src/**/*.{ts,tsx,js,jsx,json,css,scss,md}"

test:
	npm run test

build:
	npm run build

start:
	npm run start