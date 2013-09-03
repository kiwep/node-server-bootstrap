/**
 * Node.JS Server Cluster Logger
 */

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
	// console.log blocks :/
	console.log.apply(this, args);
};
exports.log = _log;

function setLogLevel(level) {
	currentLogLevel = logLevels[level];
}
exports.setLogLevel = setLogLevel;
