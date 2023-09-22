var http = require('http');
var options = {
	host: 'localhost',
	port: '8081',
	timeout: 2000,
};
var request = http.request(options, (res) => {
	console.log(`STATUS: ${res.statusCode}`);
	if (res.statusCode == 200) {
		process.exit(0);
	} else {
		process.exit(1);
	}
});
request.on('error', function (err) {
	console.log('ERROR', err);
	process.exit(1);
});
request.end();
