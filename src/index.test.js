import { expect, describe, it } from 'vitest';
import server from './index.js';
import request from 'supertest';

const app = request(server);

describe('server', () => {
	it('should be able to hit health check', async () => {
		const response = await app.get('/health-check');
		expect(response.status).toBe(200);
		expect(response.body).toEqual({ message: 'ok', date: expect.any(String), uptime: expect.anything() });
	});

	it('should be able to get / and return html', async () => {
		const response = await app.get('/');
		expect(response.status).toBe(200);
		expect(response.type).toBe('text/html');
	});

	it('should return not found for unknown routes', async () => {
		const response = await app.get('/unknown');
		expect(response.status).toBe(404);
	});
});
