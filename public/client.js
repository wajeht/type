function createDiv(id, styles) {
	const div = document.createElement('div');
	div.id = id;
	Object.assign(div.style, styles);
	document.body.appendChild(div);
	return div;
}

function showNotification() {
	createDiv('blur', {
		position: 'absolute',
		top: '0',
		left: '0',
		width: '100%',
		height: '100%',
		backdropFilter: 'blur(2px)',
		zIndex: '2',
	});

	createDiv('notification', {
		position: 'absolute',
		fontFamily: 'Monaco, monospace',
		top: '0',
		left: '0',
		width: '100%',
		height: '100%',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		color: 'white',
		fontSize: '2rem',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: '3',
		textContent: 'Disconnected from server',
	});
}

function removeElementById(id) {
	const element = document.getElementById(id);
	if (element) {
		document.body.removeChild(element);
	}
}

function removeNotification() {
	removeElementById('notification');
	removeElementById('blur');
}

const socket = io.connect('/');

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
	remoteCursor = createDiv('remote-cursor', {});
}

socket.on('connect', () => {
	// console.log('Connected to server');
	removeNotification();
	socket.emit('getLastMessage');
});

socket.on('disconnect', (reason) => {
	// console.log(`Disconnected: ${reason}`);
	showNotification();
});

myCodeMirror.on('vim-mode-change', (e) => {
	// console.log(e.mode);
	socket.emit('vim-mode-change', e.mode);
});

socket.on('vim-mode-change', (mode) => {
	remoteCursor.style.width = mode === 'insert' ? '2px' : '11px';
});

myCodeMirror.on('change', (cm, change) => {
	if (!isUpdating) {
		socket.emit('message', {
			value: cm.getValue(),
			cursorPosition: cm.getCursor(),
			selection: cm.listSelections(),
		});
	}
});

myCodeMirror.on('cursorActivity', (cm) => {
	if (!isUpdating) {
		socket.emit('cursorActivity', {
			cursorPosition: cm.getCursor(),
			selection: cm.listSelections(),
		});
	}
});

socket.on('message', (data) => {
	isUpdating = true;
	myCodeMirror.setValue(data.value);
	myCodeMirror.setCursor(data.cursorPosition);
	myCodeMirror.setSelections(data.selection);
	isUpdating = false;
});

socket.on('cursorActivity', (data) => {
	isUpdating = true;
	myCodeMirror.setCursor(data.cursorPosition);
	myCodeMirror.setSelections(data.selection);

	let cursorCoords = myCodeMirror.cursorCoords(data.cursorPosition);
	remoteCursor.style.left = cursorCoords.left + 'px';
	remoteCursor.style.top = cursorCoords.top + 'px';
	remoteCursor.style.height = cursorCoords.bottom - cursorCoords.top + 'px';
	isUpdating = false;
});
