#!/usr/bin/env node

var path = require('path');
var cluster = require('cluster');
var os = require('os');
var cc = require('./libs/cluster_controller');

var conf;
var threadRestartInterval;

//
// ------------------------------------------------------------------
// Support methods
//

function loadConfiguration(callback) {
	cc.loadConfiguration(function(err, _conf) {
		if (err) throw err;
		conf = _conf;
		cc.log(cc.INFO, 'Master: Configuration loaded');
		if (callback) callback();
	});
}

//
// ------------------------------------------------------------------
// Master process implementation
//

function startup() {
	// loading configurations
	loadConfiguration(function() {

		// thread lifetime
		var threadLifetime = conf.cluster.threadLifetime;
		if (threadLifetime) {
			cc.log(cc.INFO, 'Master: Thread lifetime set to ' + threadLifetime + ' seconds');
			threadRestartInterval = setInterval(restartThreads, threadLifetime * 1000);
		}

		// start workers
		var workerNum = conf.cluster.workers || os.cpus().length;
		cc.log(cc.INFO, 'Master: Spawning ' + workerNum + ' worker threads');
		for (var i = 0; i < workerNum; i++) {
			forkWorker();
		}

		// file watcher
		if (conf.watchFilesForChange && conf.watchFilesForChange.enabled) {
			cc.log(cc.INFO, "Master: Watching files for changes");
			cc.startChangeWatchers(conf.watchFilesForChange, filesChanged);
		}

	});
}

function shutdown() {
	cc.log(cc.INFO, 'Master: Cleaning up');

	// cleanup
	clearInterval(threadRestartInterval);
	waitingTimers.forEach(function(timer) { clearTimeout(timer); });
	cc.killChangeWatchers();

	if (masterRestarting) {
		masterRestarting = false;
		terminating = false;
		cc.log(cc.INFO, 'Master: Restarting');
		startup();
	}
	else {
		cc.clearPidFile();
		cc.log(cc.INFO, 'Master: Exit');
	}
}

function handleSigTermInt() {
	if (terminating) {
		cc.log(cc.INFO, 'Master: Forced shutdown, exiting');
		process.exit();
		return;
	}

	terminating = true;

	if (runningWorkerCount > 0) {
		cc.log(cc.INFO, 'Master: Shutting down worker threads');
		eachWorker(function(worker) {
			worker.disconnect();
			worker.send('shutdown');
		});
	}
	else {
		shutdown();
	}
}

function handleSigHup() {
	restartMaster();
}

function filesChanged(files) {
	cc.log(cc.INFO, 'Master: File changes detected, reloading');
	restartMaster();
}

//
// ------------------------------------------------------------------
// Cluster management
//

var terminating = false;
var restarting = false;
var masterRestarting = false;
var runningWorkerCount = 0;
var threadCrashCounter = 0;
var workersToRestart = [];
var waitingTimers = [];

function eachWorker(callback) {
	for (var id in cluster.workers) callback(cluster.workers[id]);
}

function forkWorker() {
	var worker = cluster.fork();
	worker.on('message', handleWorkerMessage);
}

function restartThreads() {
	var w;
	restarting = true;
	cc.log(cc.INFO, 'Master: Restarting worker threads');
	for (var id in cluster.workers) workersToRestart.push(id);
	w = cluster.workers[workersToRestart.shift()];
	w.disconnect();
	w.send('shutdown');
}

function restartMaster() {
	cc.log(cc.INFO, 'Master: Complete restart requested');
	masterRestarting = true;
	handleSigTermInt();
}

function handleWorkerMessage(msg) {
	if (msg.cmd && msg.cmd == 'reportAnswer') {
		cc.log(cc.INFO, 'Master: Received report from worker:', msg.data);
	}
}

//
// ------------------------------------------------------------------
// Cluster setup
//
cc.setBaseName(path.basename(__filename, '.js'));

cluster.setupMaster({
	exec: path.join(path.dirname(__filename), cc.baseName() + '_worker.js')
});

cluster.on('online', function(worker) {
	var w;
	cc.log(cc.INFO, 'Master: Worker thread id #' + worker.id + ' spawned');
	runningWorkerCount++;
	threadCrashCounter = 0;

	// shutdown workers waiting to restart
	if (workersToRestart.length) {
		w = cluster.workers[workersToRestart.shift()];
		w.disconnect();
		w.send('shutdown');
	}
	else if (restarting) {
		cc.log(cc.INFO, 'Master: Restart complete');
		restarting = false;
	}
});

cluster.on('exit', function(worker, code, signal) {
	var timerID;
	cc.log(cc.INFO, 'Master: Worker #' + worker.id + ' exited with return code ' + code);
	runningWorkerCount--;
	if (!terminating && (code != 0 || restarting)) {
		if (code == 0 || restarting) {
			cc.log(cc.INFO, 'Master: Starting new worker thread');
			cluster.fork();
		}
		else {
			cc.log(cc.WARN, 'Master: Worker exited with error, waiting ' + conf.cluster.respawnDelayOnError + ' secs before respawning');
			timerID = waitingTimers.length;
			waitingTimers.push(setTimeout(function() {
				waitingTimers.splice(timerID, 1);
				cc.log(cc.INFO, 'Master: Starting new worker thread');
				cluster.fork();
			}, conf.cluster.respawnDelayOnError * 1000));
		}
	}
	else if (runningWorkerCount == 0) {
		// no more running workers, shut down master
		shutdown();
	}
});

process.on('SIGTERM', function() {
	cc.log(cc.INFO, 'Master: SIGTERM signal received, shutting down');
	handleSigTermInt();
});

process.on('SIGINT', function() {
	console.log("");
	cc.log(cc.INFO, 'Master: SIGINT signal received, shutting down');
	handleSigTermInt();
});

process.on('SIGHUP', function() {
	cc.log(cc.INFO, 'Master: SIGHUP signal received, reloading');
	handleSigHup();
});

// start
startup();
cc.savePidFile();
