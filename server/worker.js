/**
 * Node.JS Server Worker
 *
 * Implement your own worker thread
 * Don't forget that this thread is can be spawned multiple times
 *
 */

var ch = require('./libs/helper');
var l = require('./libs/logger');

var conf = require(ch.confFileName);

//
// ------------------------------------------------------------------
// Worker Lifetime management
//
var isShuttingDown = false;


//
// Startup
// Called when the worker thread started
//
function startup() {
	l.log(l.INFO, 'Worker: Thread started');

	// add your startup code here
}


//
// Shutdown
// Called when the master process requests the worker to shut down
// Before the master process calls this method, it disconnects all
// the workers listeners, so the worker no longer receives new 
// connections.
// Serve all pending requests, close connections and clean up,
// then simply call process.exit(0); Master will wait until
// the worker gracefully exists with status code 0.
function shutdown() {
	isShuttingDown = true;

	l.log(l.INFO, 'Worker: Thread exited');
	process.exit(0);
}


// Handle master thread messages
// The master process can notify and command the workers trough this function
// You can extend the communication between the master and its workers here
function handleMasterMessage(msg, params) {
	if (msg == 'shutdown') shutdown();
	// add message handlers here if desired
}


//
// ------------------------------------------------------------------
//

// Setup worker
ch.setupWorker(conf, handleMasterMessage);

// Startup worker
startup();
