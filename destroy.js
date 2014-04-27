var umount = require('./umount');
var rimraf = require('rimraf');

var mnt = process.argv[2];
var pid = Number(process.argv[3]);

umount(mnt, function() {
	rimraf.sync(mnt);
	process.kill(pid, 'SIGINT');
});