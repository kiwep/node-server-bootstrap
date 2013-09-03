#!/usr/bin/env node

/**
 * Node.JS Server Base
 *
 * The master thread handler that controls all the workers 
 * and handles messages and signals. You can edit this file
 * if your threading needs differ.
 *
 */

var path = require('path');
var cluster = require('cluster');
var os = require('os');
var ch = require('./helper');
var fw = require('./watcher');
var l = require('./logger');
var conf = require(ch.confFileName);

var threadRestartInterval;

//
// ------------------------------------------------------------------
// Master process implementation
//

// Cluster setup
//
function setup() {
	ch.setBaseName(path.basename(__filename, '.js'));
	l.setLogLevel(conf.logLevel);
	cluster.setupMaster({ exec: path.join(ch.rootDirPath, conf.cluster.workerFilePath) });
}

// Startup workers and watchers
//
function startup() {

	// thread lifetime
	var threadLifetime = conf.cluster.threadLifetime;
	if (threadLifetime) {
		l.log(l.INFO, 'Master: Thread lifetime set to ' + threadLifetime + ' seconds');
		threadRestartInterval = setInterval(restartThreads, threadLifetime * 1000);
	}

	// start workers
	var workerNum = conf.cluster.workers || os.cpus().length;
	l.log(l.INFO, 'Master: Spawning ' + workerNum + ' worker threads');
	for (var i = 0; i < workerNum; i++) {
		forkWorker();
	}

	// file watcher
	if (conf.watchFilesForChange && conf.watchFilesForChange.enabled) {
		l.log(l.INFO, "Master: Watching files for changes");
		fw.startChangeWatchers(conf.watchFilesForChange, filesChanged);
	}

}

// Shutdown or restart
//
function shutdown() {
	l.log(l.INFO, 'Master: Cleaning up');

	// cleanup
	clearInterval(threadRestartInterval);
	waitingTimers.forEach(function(timer) { clearTimeout(timer); });
	fw.killChangeWatchers();

	if (masterRestarting) {
		masterRestarting = false;
		terminating = false;
		l.log(l.INFO, 'Master: Restarting');
		startup();
	}
	else {
		ch.clearPidFile();
		l.log(l.INFO, 'Master: Exit');
	}
}

// Handle TERM and INT signals
//
function handleSigTermInt() {
	if (terminating) {
		l.log(l.INFO, 'Master: Forced shutdown, exiting');
		process.exit();
		return;
	}

	terminating = true;

	if (runningWorkerCount > 0) {
		l.log(l.INFO, 'Master: Shutting down worker threads');
		eachWorker(function(worker) {
			worker.disconnect();
			worker.send('shutdown');
		});
	}
	else {
		shutdown();
	}
}

// Handle HUP signal
//
function handleSigHup() {
	restartMaster();
}

// Handle file change notification
//
function filesChanged(files) {
	l.log(l.INFO, 'Master: File changes detected, reloading');
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

// eachWorker helper method
//
function eachWorker(callback) {
	for (var id in cluster.workers) callback(cluster.workers[id]);
}

// Spawn a new worker
//
function forkWorker() {
	var worker = cluster.fork();
	worker.on('message', handleWorkerMessage);
}

// Initiate restarting all workers
// 
function restartThreads() {
	var w;
	restarting = true;
	l.log(l.INFO, 'Master: Restarting worker threads');
	for (var id in cluster.workers) workersToRestart.push(id);
	w = cluster.workers[workersToRestart.shift()];
	w.disconnect();
	w.send('shutdown');
}

// Restart master
//
function restartMaster() {
	l.log(l.INFO, 'Master: Complete restart requested');
	masterRestarting = true;
	handleSigTermInt();
}

// Handle worker messages
//
function handleWorkerMessage(msg) {
	// implement worker message handling if needed
}

// Worker online event handler
//
function onWorkerOnline(worker) {
	var w;
	l.log(l.INFO, 'Master: Worker thread id #' + worker.id + ' spawned');
	runningWorkerCount++;
	threadCrashCounter = 0;

	// shutdown workers waiting to restart
	if (workersToRestart.length) {
		w = cluster.workers[workersToRestart.shift()];
		w.disconnect();
		w.send('shutdown');
	}
	else if (restarting) {
		l.log(l.INFO, 'Master: Restart complete');
		restarting = false;
	}
}
cluster.on('online', onWorkerOnline);

// Worker exit event handler
//
function onWorkerExit(worker, code, signal) {
	var timerID;
	l.log(l.INFO, 'Master: Worker #' + worker.id + ' exited with return code ' + code);
	runningWorkerCount--;
	if (!terminating && (code != 0 || restarting)) {
		if (code == 0 || restarting) {
			l.log(l.INFO, 'Master: Starting new worker thread');
			cluster.fork();
		}
		else {
			l.log(l.WARN, 'Master: Worker exited with error, waiting ' + conf.cluster.respawnDelayOnError + ' secs before respawning');
			timerID = waitingTimers.length;
			waitingTimers.push(setTimeout(function() {
				waitingTimers.splice(timerID, 1);
				l.log(l.INFO, 'Master: Starting new worker thread');
				cluster.fork();
			}, conf.cluster.respawnDelayOnError * 1000));
		}
	}
	else if (runningWorkerCount == 0) {
		// no more running workers, shut down master
		shutdown();
	}
}
cluster.on('exit', onWorkerExit);

// SIGTERM event handler
//
function onSigterm() {
	l.log(l.INFO, 'Master: SIGTERM signal received, shutting down');
	handleSigTermInt();
}
process.on('SIGTERM', onSigterm);

// SIGINT event handler
//
function onSigint() {
	console.log("");
	l.log(l.INFO, 'Master: SIGINT signal received, shutting down');
	handleSigTermInt();
}
process.on('SIGINT', onSigint);

// SIGHUP event handler
//
function onSighup() {
	l.log(l.INFO, 'Master: SIGHUP signal received, reloading');
	handleSigHup();
}
process.on('SIGHUP', onSighup);

//
// ------------------------------------------------------------------
// Start
//
setup();
startup();
ch.savePidFile();
