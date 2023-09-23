import { request } from 'node:http';

const options = {
	hostname: 'localhost',
	port: 8081,
	path: '/api/health-check',
	method: 'GET',
};

request(options, (res) => {
	let body = '';

	res.on('data', (chunk) => {
		body += chunk;
	});

	res.on('end', () => {
		try {
			// Ensure the response is valid JSON before parsing
			const isValidJSON = () => {
				try {
					JSON.parse(body);
					return true;
				} catch {
					return false;
				}
			};

			if (isValidJSON() && JSON.parse(body).healthy === true) {
				process.exit(0);
			} else {
				console.log('Unhealthy response received: ', body);
				process.exit(1);
			}
		} catch (err) {
			console.log('Error parsing JSON response body: ', err);
			process.exit(1);
		}
	});
})
	.on('error', (err) => {
		console.log('Error: ', err);
		process.exit(1);
	})
	.end();
