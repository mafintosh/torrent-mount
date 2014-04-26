#!/usr/bin/env node

var drive = require('./');
var readTorrent = require('read-torrent');
var log = require('single-line-log');
var prettysize = require('prettysize');
var rimraf = require('rimraf');
var fs = require('fs');
var umount = require('./umount');

if (process.argv.length < 3) {
	console.error('Usage: torrent-mount torrent_or_magnet_link [directory]');
	process.exit(1);
}

readTorrent(process.argv[2], function(err, torrent) {
	if (err) {
		console.error(err.message);
		process.exit(2);
	}

	var mnt = fs.realpathSync(process.argv[3] || '.');
	var engine = drive(torrent, mnt);
	var hs = 0;

	engine.on('hotswap', function() {
		hs++;
	});

	log('Initializing swarm and verifying data...\n');
	engine.on('mount', function(mnt) {
		log('Mounted '+engine.files.length+' files, '+prettysize(engine.torrent.length)+' in '+ engine.torrent.name);
		log.clear();

		var notChoked = function(result, wire) {
			return result + (wire.peerChoking ? 0 : 1);
		};

		var status = function() {
			var down = prettysize(engine.swarm.downloaded);
			var downSpeed = prettysize(engine.swarm.downloadSpeed()).replace('Bytes', 'b')+'/s';
			var up = prettysize(engine.swarm.uploaded);
			var upSpeed = prettysize(engine.swarm.uploadSpeed()).replace('Bytes', 'b')+'/s';

			log(
				'Connected to '+engine.swarm.wires.reduce(notChoked, 0)+'/'+engine.swarm.wires.length+' peers\n'+
				'Downloaded '+down+' ('+downSpeed+') with '+hs+' hotswaps\n'+
				'Uploaded '+up+ ' ('+upSpeed+')\n'
			);
		};

		setInterval(status, 500);
		status();

		var onclose = function() {
			engine.destroy(function() {
				umount(mnt)
				setTimeout(function() {
					rimraf.sync(mnt);
					process.exit();
				}, 250);
			});
		};

		process.on('SIGINT', onclose);
		process.on('SIGTERM', onclose);
	});
});