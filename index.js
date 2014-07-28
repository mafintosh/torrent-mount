var f4js = require('fuse4js');
var fs = require('fs');
var mkdirp = require('mkdirp');
var torrents = require('torrent-stream');
var path = require('path');
var umount = require('./umount');

var ENOENT = -2;
var EPERM = -1;
var EINVAL = -22;

module.exports = function(source, mnt, isLazy) {
	if (!mnt) mnt = '.';

	var handlers = {};
	var engine = torrents(source);

	engine.on('ready', function() {
		if (engine.torrent.name === (engine.files[0] && engine.files[0].path)) {
			var dir = engine.torrent.name.replace(/\.[^.]+$/, '');
			engine.torrent.files.forEach(function(file) {
				file.path = path.join(dir, file.path);
			});
			engine.torrent.name = dir;
		}

		mnt = path.join(mnt, path.resolve('/', engine.torrent.name));
		umount(mnt, function() {
			mkdirp(mnt, function() {
				f4js.start(mnt, handlers, false, []);
				engine.emit('mount', mnt);
			});
		});
        if(!isLazy) {
            engine.files.forEach(function (file) {
                file.path = file.path.slice(engine.torrent.name.length + 1);
                file.select();
            });
        }
		engine.on('uninterested', function() {
			engine.swarm.pause();
		});
		engine.on('interested', function() {
			engine.swarm.resume();
		});
	});

	var find = function(path) {
		return engine.files.reduce(function(result, file) {
			return result || (file.path === path && file);
		}, null);
	};

	handlers.getattr = function(path, cb) {
		path = path.slice(1);

		var stat = {};
		var file = find(path);

		if (file) {
			stat.size = file.length;
			stat.mode = 0100666;
			return cb(0, stat);
		}

		stat.size = 4096;
		stat.mode = 040755;

		if (!path) return cb(0, stat);

		var dir = engine.files.some(function(file) {
			return file.path.indexOf(path+'/') === 0;
		});

		if (!dir) return cb(ENOENT);
		cb(0, stat);
	};

	var files = {};

	handlers.open = function(path, flags, cb) {
		path = path.slice(1);

		var file = find(path);
		if (!file) return cb(ENOENT);

		var fs = files[path] = files[path] || [];
		var fd = fs.indexOf(null);
		if (fd === -1) fd = fs.length;

		fs[fd] = {offset:0};

		cb(0, fd);
	};

	handlers.release = function(path, handle, cb) {
		path = path.slice(1);

		var fs = files[path] || [];
		var f = fs[handle];

		if (f && f.stream) f.stream.destroy();
		fs[handle] = null;

		cb(0);
	};

	handlers.readdir = function(path, cb) {
		path = path.slice(1);

		var uniq = {};
		var files = engine.files
			.filter(function(file) {
				return file.path.indexOf(path ? path+'/' : '') === 0;
			})
			.map(function(file) {
				return file.path.slice(path ? path.length+1 : 0).split('/')[0]
			})
			.filter(function(name) {
				if (uniq[name]) return false;
				return uniq[name] = true;
			});

		if (!files.length) return cb(ENOENT);
		cb(0, files);
	};

	handlers.read = function(path, offset, len, buf, handle, cb) {
		path = path.slice(1);

		var file = find(path);
		var fs = files[path] || [];
		var f = fs[handle];

		if (!file) return cb(ENOENT);
		if (!f) return cb(ENOENT);

		if (len + offset > file.length) len = file.length - offset;

		if (f.stream && f.offset !== offset) {
			f.stream.destroy();
			f.stream = null;
		}

		if (!f.stream) {
			f.stream = file.createReadStream({start:offset});
			f.offset = offset;
		}

		var loop = function() {
			var result = f.stream.read(len);
			if (!result) return f.stream.once('readable', loop);
			result.copy(buf);
			cb(result.length);
		};

		loop();
	};

	handlers.write = function(path, offset, len, buf, handle, cb) {
		cb(EPERM);
	};

	handlers.unlink = function(path, cb) {
		cb(EPERM);
	};

	handlers.rename = function(src, dst, cb) {
		cb(EPERM);
	};

	handlers.mkdir = function(path, mode, cb) {
		cb(EPERM);
	};

	handlers.rmdir = function(path, cb) {
		cb(EPERM);
	};

	handlers.create = function(path, mode, cb) {
		cb(EPERM);
	};

	handlers.getxattr = function(path, cb) {
		cb(EPERM);
	};

	handlers.setxattr = function(path, name, value, size, a, b, cb) {
		cb(0);
	};

	handlers.statfs = function(cb) {
		cb(0, {
			bsize: 1000000,
			frsize: 1000000,
			blocks: 1000000,
			bfree: 1000000,
			bavail: 1000000,
			files: 1000000,
			ffree: 1000000,
			favail: 1000000,
			fsid: 1000000,
			flag: 1000000,
			namemax: 1000000
		});
	};

	handlers.destroy = function(cb) {
		cb();
	};

	return engine;
};