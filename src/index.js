import { createServer } from 'http';
import { Server } from 'socket.io';

import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8081;

export async function skipOnMyIp(_req, _res) {
	const myIp = await getIPAddress();
	const myIpWasConnected = myIp === process.env.MY_IP;
	// if (myIpWasConnected) console.log(`my ip was connected: ${myIp}`);
	return myIpWasConnected;
}

const rateLimiterMiddleware = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true,
	legacyHeaders: false,
	message: 'Too many requests, please try again later!',
	skip: skipOnMyIp,
});

app.set('trust proxy', 1);
app.use(
	helmet.contentSecurityPolicy({
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			'default-src': ["'self'", 'plausible.jaw.dev'],
			'script-src': ["'self'", "'unsafe-inline'", 'plausible.jaw.dev'],
		},
	}),
);

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiterMiddleware);
app.use(
	express.static(path.resolve(path.join(process.cwd(), 'public')), {
		// 30 days in miliseconds
		maxAge: 30 * 24 * 60 * 60 * 1000,
	}),
);

app.get('/', async (req, res, next) => {
	try {
		const index = path.resolve(
			path.join(process.cwd(), 'public', 'index.html'),
		);
		const html = await fs.readFile(index, 'utf-8');
		return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
	} catch (error) {
		console.error(error);
		next(error);
	}
});

app.get('/health-check', (req, res) => {
	return res.status(200).json({
		message: 'ok',
		uptime: process.uptime(),
		date: new Date(),
	});
});

app.use((req, res, _next) => {
	return res.status(404).send("Sorry can't find that!");
});

app.use((err, req, res, _next) => {
	console.error(err.stack);
	return res.status(500).send('Something broke!');
});

let DEFAULT_MESSAGE = `// Welcome to the collaborative code editor in JavaScript with Vim keybindings!\n`;
DEFAULT_MESSAGE += `// Open this page in another browser/tab/phone and start coding together!\n\n`;
DEFAULT_MESSAGE += `console.log('Hello, World!');`;

let lastMessage = '';
let lastSelection = [];
let sockets = new Set();
let lastCursorPosition = { line: 0, ch: 0 };

io.on('connection', (socket) => {
	sockets.add(socket);
	console.log('a user connected');

	socket.on('vim-mode-change', (mode) => {
		socket.broadcast.emit('vim-mode-change', mode);
	});

	socket.on('getLastMessage', () => {
		socket.emit('message', {
			value: lastMessage,
			cursorPosition: lastCursorPosition,
			selection: lastSelection,
		});
	});

	socket.on('message', (data) => {
		console.log('Received message:', data.value);
		lastMessage = data.value;
		lastCursorPosition = data.cursorPosition;
		lastSelection = data.selection;
		socket.broadcast.emit('message', {
			value: lastMessage,
			cursorPosition: lastCursorPosition,
			selection: lastSelection,
		});
	});

	socket.on('cursorActivity', (data) => {
		lastCursorPosition = data.cursorPosition;
		lastSelection = data.selection;
		socket.broadcast.emit('cursorActivity', {
			cursorPosition: lastCursorPosition,
			selection: lastSelection,
		});
	});

	socket.on('disconnect', () => {
		sockets.delete(socket);
		console.log('user disconnected');
		resetToDefaultMessage();
	});
});

function resetToDefaultMessage() {
	if (sockets.size === 0) {
		lastMessage = DEFAULT_MESSAGE;
		lastCursorPosition = { line: 0, ch: 0 };
		lastSelection = [];
	}
}

export default server;

const appServer = server.listen(PORT, () => {
	console.log(`Server was started at http://localhost:${PORT}`);
});

export async function getIPAddress() {
	try {
		const response = await fetch('https://ip.jaw.dev');
		const data = await response.text();
		return data.trim();
	} catch (error) {
		console.error('Error fetching IP address:', error);
		throw error;
	}
}

function gracefulShutdown() {
	console.log('Received kill signal, shutting down gracefully.');

	try {
		sockets.forEach((socket) => {
			socket.disconnect(true);
		});

		io.close(() => {
			console.log('Socket.io closed.');
		});

		server.close(() => {
			console.log('Closed out remaining connections.');
			process.exit();
		});

		appServer.close(() => {
			console.log('Express closed out remaining connections.');
		});
	} catch (error) {
		console.error('Error during shutdown', error);
	}

	setTimeout(() => {
		console.error(
			'Could not close connections in time, forcefully shutting down',
		);
		process.exit(1);
	}, 10 * 1000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at: ', promise, ' reason: ', reason);
});
