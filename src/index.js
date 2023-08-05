import { createServer } from 'http';
import { Server } from 'socket.io';

import fs from 'fs/promises';
import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = 8080;
let lastMessage = '';
let lastSelection = [];
let sockets = new Set();
let lastCursorPosition = { line: 0, ch: 0 };

app.use(
	helmet.contentSecurityPolicy({
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			'default-src': ["'self'", 'plausible.jaw.dev'],
			'script-src': ["'self'", "'unsafe-inline'", 'plausible.jaw.dev'],
		},
	}),
);

app.disable('x-powered-by');

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	express.static(path.resolve(path.join(process.cwd(), 'public')), {
		// 30 days in miliseconds
		maxAge: 30 * 24 * 60 * 60 * 1000,
	}),
);

app.get('/', async (req, res) => {
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

app.use((req, res, next) => {
	return res.status(404).send("Sorry can't find that!");
});

app.use((err, req, res, next) => {
	console.error(err.stack);
	return res.status(500).send('Something broke!');
});

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
	});
});

function gracefulShutdown() {
	console.log('Received kill signal, shutting down gracefully.');

	sockets.forEach((socket) => {
		socket.disconnect(true);
	});

	server.close(() => {
		console.log('Closed out remaining connections.');
		process.exit();
	});

	setTimeout(() => {
		console.error(
			'Could not close connections in time, forcefully shutting down',
		);
		process.exit(1);
	}, 10 * 1000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
	console.log(`Server was started at http://localhost:${PORT}`);
});
