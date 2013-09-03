/**
 * Node.JS Server Cluster File watcher
 */

var fs = require('fs');
var path = require('path');
var util = require("util");
var l = require('./logger');

var watchers = [];
var rootDirPath = path.dirname(__filename).split(path.sep).slice(0, -1).join(path.sep);

function bind(fn, obj) {
	return function() {
		return fn.apply(obj, arguments);
	}
}

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
				l.log(l.DEBUG, 'Debug: File Watcher: Change detected at path "' + fullPath + '", saving for report');
				this.hitPathList.push(fullPath);
				this.scheduleEmitTimer();
			}
			else {
				l.log(l.DEBUG, 'Debug: File Watcher: "' + fullPath + '" excluded, skipping');
			}
		}
		else {
			l.log(l.DEBUG, 'Debug: File Watcher: "' + filename + '" extension did not match, skipping');
		}
	}
	else {
		l.log(l.DEBUG, 'Debug: File Watcher did not receive filename, skipping event');
	}
};

FileWatcher.prototype.scheduleEmitTimer = function() {
	if (this.emitTimer) {
		clearTimeout(this.emitTimer);
		this.emitTimer = false;
	}
	if (this.reportInterval) {
		if (!this.bindedReportHits) this.bindedReportHits = bind(this.reportHits, this);
		this.emitTimer = setTimeout(this.bindedReportHits, this.reportInterval * 1000);
	}
	else {
		this.reportHits();
	}
};

FileWatcher.prototype.reportHits = function() {
	l.log(l.DEBUG, 'Debug: File Watcher: Reporting file changes');
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
		l.log(l.DEBUG, 'Debug: Dir "' + dir + '" excluded, skipping');
		return;
	}
	l.log(l.DEBUG, 'Debug: Watching dir "' + dir + '" for changes');
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

exports.setup = function(_rootDirPath) {
	rootDirPath = _rootDirPath;
}

// Warning: this is a synchronous function
// Note that the master thread calls this method only once when it's starting, so not a big deal
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
