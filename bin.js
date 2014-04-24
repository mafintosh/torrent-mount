#!/usr/bin/env node

var drive = require('./');
var readTorrent = require('read-torrent');
var log = require('single-line-log');
var prettysize = require('prettysize');

if (process.argv.length < 3) {
	console.error('Usage: torrent-mount torrent_or_magnet_link [directory]');
	process.exit(1);
}

readTorrent(process.argv[2], function(err, torrent) {
	if (err) {
		console.error(err.message);
		process.exit(2);
	}

	var mnt = process.argv[3] || '.';
	var engine = drive(torrent, mnt);

	log('Initializing...');
	engine.on('ready', function() {
		log('Mounted '+engine.files.length+' files, '+prettysize(engine.torrent.length)+' in '+ engine.torrent.name);
		log.clear();

		var notChoked = function(result, wire) {
			return result + (wire.peerChoking ? 0 : 1);
		};

		var status = function() {
			var down = prettysize(engine.swarm.downloaded);
			var speed = prettysize(engine.swarm.downloadSpeed())+'/s';
			log('Downloaded '+down+' ('+speed+') from '+engine.swarm.wires.reduce(notChoked, 0)+'/'+engine.swarm.wires.length+' peers\n');
		};

		setInterval(status, 500);
		status();
	});
});