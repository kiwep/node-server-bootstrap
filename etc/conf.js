/**
 * Node.JS Server Configuration file
 *
 * Use this configuration file to store all of
 * your services and modules configuration.
 * A worker loads this file every time it starts
 * so changes will apply. The master however only
 * reads the configuration when the whole server
 * starts, so you need to restart the server if
 * you changed any threading or file watching
 * parameter.
 *
 */

var conf = {};
var mins = 60, hours = 60 * 60;

//
// General production configuration. 
// Use this object to set up the production parameters. 
//
// Times are in seconds. To express minutes or hours, use the following formula: [n * mins|hours].
//
conf.general = {

	// Log level. Possible values: error|warn|info|debug.
	logLevel: "warn",

	// Cluster parameters
	cluster: {

		// Number of worker threads. 0 = number of processor cores.
		workers: 0,

		// The relative path to the worker file.
		workerFilePath: "server/worker.js",

		// Workers will be respawned after the end of their lifetime. 0 = no respawn.
		// It's generally a good idea to design the workers to be able to die gacefully as
		// restarting the workers eliminates leaks and such. Workers are restarted
		// sequentally so the server won't go down if you have more than one worker.
		threadLifetime: 4 * hours,

		// When a worker exited with an error code, wait this amount. This throttles error messages in development.
		respawnDelayOnError: 3
	},

	// Automatically restart the workers when a file change detected.
	// This feature has practically no effect on performance, so you can use this in production too.
	watchFilesForChange: {

		// Turns on/off the watcher. Possible values: true|false
		enabled: false,

		// Watch these directories only.
		paths: ["etc", "server"],

		// Watch file changes with this extension only. Can be empty to watch all files.
		extensions: [".js", ".json", ".html", ".ejs", ".swig"],

		// Exclusion patterns. Values are turned into regular expressions.
		exclude: ["node_modules", "^\\.", "^~"],

		// Collect changes and report them in batch after this interval.
		// Useful in production when you are copying file over and don't want the workers
		// to restart when only the first files are changed. 0 = report immediately
		reportInterval: 45

	}
};

//
// Development specific configuration. 
// These options will be merged with the general object thus overwriting the production parameters.
// Specify only those parameters that are different from production.
//
conf.development = {
	logLevel: "info",
	cluster: {
		workers: 1,
		threadLifetime: 0,
		respawnDelayOnError: 10
	},
	watchFilesForChange: {
		enabled: true,
		reportInterval: 0
	}
};

//
// ------------------------------------------------------------------
// Exporting configuration
//
function isType(o, t) { 
	return o !== undefined && o !== null && Object.prototype.toString.call(o).slice(8, -1) == t;
}
function merge() {
	var d = {}, s, p, a = [].splice.call(arguments, 0), o = 'Object';
	while (a.length > 0) {
		s = a.shift();
		if (isType(s, o)) for (p in s) if (s.hasOwnProperty(p))
			if (isType(s[p], o)) d[p] = merge(d[p] || {}, s[p]);
			else d[p] = s[p];
	}
	return d;
}

module.exports = (String(process.env['NODE_ENV']).toLowerCase() == 'production') ? conf.general : merge(conf.general, conf.development);
