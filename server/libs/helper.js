/**
 * Node.JS Server Cluster Helper
 */

var fs = require('fs');
var path = require('path');
var util = require("util");
var fw = require('./watcher');
var l = require('./logger');

var rootDirPath = path.dirname(__filename).split(path.sep).slice(0, -2).join(path.sep);
var baseName;
var etcDirPath = path.join(rootDirPath, 'etc');
var varDirPath = path.join(rootDirPath, 'var');
var nodeEnv = (String(process.env['NODE_ENV']).toLowerCase() == 'production') ? 'production' : 'development';

//
// ------------------------------------------------------------------
// Exported Params
//
exports.isDevelopment = (nodeEnv == 'development');
exports.isProduction = (nodeEnv == 'production');
exports.confFileName = path.join(etcDirPath, 'conf.js');

//
// ------------------------------------------------------------------
// Master utils
//
exports.setBaseName = function(name) {
	baseName = name;
};

exports.baseName = function() {
	return baseName;
};

exports.savePidFile = function() {
	var pidFileName = path.join(varDirPath, baseName + '.pid');
	fs.writeFileSync(pidFileName, process.pid);
};

exports.clearPidFile = function() {
	var pidFileName = path.join(varDirPath, baseName + '.pid');
	if (fs.existsSync(pidFileName)) {
		fs.unlinkSync(pidFileName);
	}
};

//
// ------------------------------------------------------------------
// Worker utils
//
exports.setupWorker = function(conf, handleMasterMessage) {
	// handle process messages
	process.on('message', handleMasterMessage);

	// empty SIGINT handler on worker
	process.on('SIGINT', function() {});

	// set log level
	l.setLogLevel(conf.logLevel);
};

