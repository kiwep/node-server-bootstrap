//
// ------------------------------------------------------------------
// Cluster Controller
//
var fs = require('fs');
var path = require('path');
var util = require("util");
// var EventEmitter = require('events').EventEmitter;

var rootDirPath = path.dirname(__filename).split(path.sep).slice(0, -2).join(path.sep);
var baseName;
var etcDirPath = path.join(rootDirPath, 'etc');
var varDirPath = path.join(rootDirPath, 'var');
var nodeEnv = (String(process.env['NODE_ENV']).toLowerCase() == 'production') ? 'production' : 'development';

//
// ------------------------------------------------------------------
// Module helpers
//
function bind(fn, obj) {
	return function() {
		return fn.apply(obj, arguments);
	}
}

//
// ------------------------------------------------------------------
// Configuration and Environment Loader
//
exports.loadConfiguration = function(callback)
{
	var confFileName = path.join(etcDirPath, 'conf.json');
	var envFileName = path.join(etcDirPath, 'env.json');

	// load conf file content
	fs.readFile(confFileName, { encoding: 'utf-8' }, function(err, data) {
		if (err) { if (callback) callback(err); return; }

		// process conf
		var conf = JSON.parse(data)[nodeEnv];

		// internals
		currentLogLevel = logLevels[conf.logLevel];

		// done, callback
		if (callback) callback(undefined, conf);

	});
};

//
// ------------------------------------------------------------------
// Logging
//
var logLevels = {
	'error': 1,
	'warn': 2,
	'info': 4,
	'debug': 8
};
var currentLogLevel = logLevels.error;
exports.ERROR = logLevels.error;
exports.WARN = logLevels.warning;
exports.INFO = logLevels.info;
exports.DEBUG = logLevels.debug;

function now() {
	var d = new Date(),
		m = d.getMonth() + 1,
		t = d.getDate(),
		o = d.getHours(),
		i = d.getMinutes(),
		s = d.getSeconds();
	return ['[', d.getFullYear(), '-', (m < 10 ? '0' : ''), m, '-', (t < 10 ? '0' : ''), t, ' ', 
		(o < 10 ? '0' : ''), o, ':',
		(i < 10 ? '0' : ''), i, ':',
		(s < 10 ? '0' : ''), s, 
	']'].join('');
}
exports.now = now;

function cpid() {
	return '(#' + process.pid + ')';
}
exports.cpid = cpid;

function _log(level) {
	if (level > currentLogLevel) return;
	var args = Array.prototype.slice.call(arguments);
	args.shift();
	args.unshift(now(), cpid());
	console.log.apply(this, args);
};
exports.log = _log;

//
// ------------------------------------------------------------------
// Master utils
//
exports.setBaseName = function(name) {
	baseName = name;
}

exports.savePidFile = function() {
	var pidFileName = path.join(varDirPath, baseName + '.pid');
	fs.writeFileSync(pidFileName, process.pid);
};

exports.clearPidFile = function() {
	var pidFileName = path.join(varDirPath, baseName + '.pid');
	if (fs.existsSync(pidFileName)) {
		fs.unlinkSync(pidFileName);
	}
}

//
// ------------------------------------------------------------------
// File System watcher
//
function FileWatcher(path, extensions, excudes, reportInterval, callback) {
	this.path = path;
	this.extensions = extensions || [];
	this.excudes = createRegexpArray(excudes || []);
	this.reportInterval = reportInterval || 0;
	this.callback = callback;
	this.hitPathList = [];
	this.emitTimer = false;
	this.watcher = fs.watch(this.path, { persistent: false }, bind(this._onFileChange, this));

}

FileWatcher.prototype._onFileChange = function(event, filename) {
	if (filename) {
		// check extension
		var ext = path.extname(filename);
		if (this.extensions.length == 0 || this.extensions.indexOf(ext) > -1) {
			// check excluded patterns
			var fullPath = path.join(this.path, filename);
			if (!matchRegexpArray(this.excudes, filename) && !matchRegexpArray(this.excudes, fullPath)) {
				// ok, we have a hit, save it
				_log(logLevels.debug, 'Debug: File Watcher: Change detected at path "' + fullPath + '", saving for report');
				this.hitPathList.push(fullPath);
				this.scheduleEmitTimer();
			}
			else {
				_log(logLevels.debug, 'Debug: File Watcher: "' + fullPath + '" excluded, skipping');
			}
		}
		else {
			_log(logLevels.debug, 'Debug: File Watcher: "' + filename + '" extension did not match, skipping');
		}
	}
	else {
		_log(logLevels.debug, 'Debug: File Watcher did not receive filename, skipping event');
	}
};

FileWatcher.prototype.scheduleEmitTimer = function() {
	if (this.emitTimer) {
		clearTimeout(this.emitTimer);
	}
	if (this.reportInterval) {
		this.emitTimer = setTimeout(bind(this.reportHits, this), this.reportInterval);
	}
	else {
		this.reportHits();
	}
};

FileWatcher.prototype.reportHits = function() {
	_log(logLevels.debug, 'Debug: File Watcher: Reporting file changes');
	if (this.emitTimer) {
		clearTimeout(this.emitTimer);
		this.emitTimer = null;
	}
	this.callback(this.hitPathList);
	this.hitPathList = [];
};

FileWatcher.prototype.destroy = function() {
	this.watcher.close();
	this.watcher = null;
	this.callback = null;
};

var watchers = [];

function listSubdirsSync(dir) {
	var o = [];
	fs.readdirSync(dir).forEach(function(fname) {
		if (fs.statSync(path.join(dir, fname)).isDirectory()) {
			o.push(fname);
		}
	});
	return o;
}

// Watch a directory path recursively
function watchDir(dir, options, excludes, callback) {
	if (matchRegexpArray(excludes, dir)) {
		_log(logLevels.debug, 'Debug: Dir "' + dir + '" excluded, skipping');
		return;
	}
	_log(logLevels.debug, 'Debug: Watching dir "' + dir + '" for changes');
	watchers.push(new FileWatcher(dir, options.extensions, options.exclude, options.reportInterval, callback));
	listSubdirsSync(dir).forEach(function(fpath) {
		var sdir = path.join(dir, fpath);
		watchDir(sdir, options, excludes, callback);
	});
}

function createRegexpArray(arr) {
	var o = [];
	(arr || []).forEach(function(pattern) {
		o.push(new RegExp(pattern, 'i'));
	});
	return o;
}

function matchRegexpArray(arr, str) {
	return arr.some(function(regexp) {
		return Array.isArray(regexp.exec(str));
	});
}

// Warning: this is a synchronous function - but to be honest this is a developer feature, so I really don't care
// Also note that the master thread calls this method once when it's starting, so again, not a big deal
exports.startChangeWatchers = function(options, callback) {
	var excludes = createRegexpArray(options.exclude);
	(options.paths || []).forEach(function(fpath) {
		var dir = path.join(rootDirPath, fpath);
		watchDir(dir, options, excludes, callback);
	});
};

exports.killChangeWatchers = function() {
	watchers.forEach(function(watcher) {
		watcher.destroy();
	});
	watchers = [];
};
