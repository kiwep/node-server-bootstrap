//
// Base Worker
//
var cc = require('./libs/cluster_controller');
// var x = require('');

//
// ------------------------------------------------------------------
// Module functions
//

//
// ------------------------------------------------------------------
// Process Management
//
var conf;

function startup() {
	cc.loadConfiguration(function(err, _conf) {
		if (err) throw err;
		conf = _conf;
		cc.log(cc.INFO, 'Worker: Configuration loaded');



	});
}

function shutdown() {
	process.exit(0);
}

function report() {
	return 'test report';
}

//
// ------------------------------------------------------------------
// Module Interface
//

process.on('message', function(msg) {
	if (msg == 'shutdown') shutdown();
	else if (msg == 'report') process.send({ cmd: 'reportAnswer', data: report() });
});

startup();
