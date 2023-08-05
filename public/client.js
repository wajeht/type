function showNotification() {
	// Create a div for blur effect
	const blur = document.createElement('div');
	blur.id = 'blur';
	blur.style.position = 'absolute';
	blur.style.top = '0';
	blur.style.left = '0';
	blur.style.width = '100%';
	blur.style.height = '100%';
	blur.style.backdropFilter = 'blur(2px)';
	blur.style.zIndex = '2';
	document.body.appendChild(blur);

	// Create a div for notification
	const div = document.createElement('div');
	div.id = 'notification';
	div.textContent = 'Disconnected from server';
	div.style.position = 'absolute';
	div.style.fontFamily = 'Monaco, monospace';
	div.style.top = '0';
	div.style.left = '0';
	div.style.width = '100%';
	div.style.height = '100%';
	div.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
	div.style.color = 'white';
	div.style.fontSize = '2rem';
	div.style.display = 'flex';
	div.style.justifyContent = 'center';
	div.style.alignItems = 'center';
	div.style.zIndex = '3';
	document.body.appendChild(div);
}

function removeNotification() {
	const notification = document.getElementById('notification');
	const blur = document.getElementById('blur');

	if (blur) {
		document.body.removeChild(blur);
	}

	if (notification) {
		document.body.removeChild(notification);
	}
}

const socket = io.connect('/');
let isUpdating = false;

const myCodeMirror = CodeMirror(document.body, {
	value: '',
	mode: 'javascript',
	lineNumbers: true,
	keyMap: 'vim',
	showCursorWhenSelecting: true,
	lineWrapping: true,
});

myCodeMirror.focus();

let remoteCursor = document.getElementById('remote-cursor');

if (!remoteCursor) {
	remoteCursor = document.createElement('div');
	remoteCursor.id = 'remote-cursor';
	document.body.appendChild(remoteCursor);
}

socket.on('connect', function () {
	console.log('Connected to server');
	removeNotification();
	socket.emit('getLastMessage');
});

socket.on('disconnect', (reason) => {
	console.log(`Disconnected: ${reason}`);
	showNotification();
});

myCodeMirror.on('vim-mode-change', function (e) {
	console.log(e.mode);
	socket.emit('vim-mode-change', e.mode);
});

socket.on('vim-mode-change', function (mode) {
	if (mode === 'insert') {
		remoteCursor.style.width = '2px';
	} else if (mode === 'normal' || mode === 'visual') {
		remoteCursor.style.width = '11px';
	}
});

myCodeMirror.on('change', function (cm, change) {
	if (!isUpdating) {
		const data = {
			value: cm.getValue(),
			cursorPosition: cm.getCursor(),
			selection: cm.listSelections(),
		};
		socket.emit('message', data);
	}
});

myCodeMirror.on('cursorActivity', function (cm) {
	if (!isUpdating) {
		socket.emit('cursorActivity', {
			cursorPosition: cm.getCursor(),
			selection: cm.listSelections(),
		});
	}
});

socket.on('message', function (data) {
	isUpdating = true;
	myCodeMirror.setValue(data.value);
	myCodeMirror.setCursor(data.cursorPosition);
	myCodeMirror.setSelections(data.selection);
	isUpdating = false;
});

socket.on('cursorActivity', function (data) {
	isUpdating = true;
	myCodeMirror.setCursor(data.cursorPosition);
	myCodeMirror.setSelections(data.selection);

	let cursorCoords = myCodeMirror.cursorCoords(data.cursorPosition);

	remoteCursor.style.left = cursorCoords.left + 'px';
	remoteCursor.style.top = cursorCoords.top + 'px';
	remoteCursor.style.height = cursorCoords.bottom - cursorCoords.top + 'px';

	isUpdating = false;
});
