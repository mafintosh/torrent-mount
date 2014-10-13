#!/usr/bin/env node

var drive = require('./');
var readTorrent = require('read-torrent');
var log = require('single-line-log');
var prettysize = require('prettysize');
var rimraf = require('rimraf');
var fs = require('fs');
var proc = require('child_process');
var path = require('path');
var umount = require('./umount');
var opts = require("nomnom")
    .script("torrent-mount")
    .options({
        source: {
            position: 0,
            help: ".torrent file or magnet link to open",
            list: true,
            required: true
        },
        mount: {
            abbr: 'm',
            metavar: 'PATH',
            help: "Mount location path [directory]",
            default: "."
        },
        lazy: {
            abbr: 'l',
            flag: true,
            help: "Download only if accessed"
        }
    }).parse();

readTorrent(opts["source"][0], function(err, torrent) {
	if (err) {
		console.error(err.message);
		process.exit(2);
	}

	var mnt = fs.realpathSync(opts["mount"]);
    var isLazy = opts["lazy"]
	var engine = drive(torrent, mnt, isLazy);
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

		var interval = setInterval(status, 500);
		status();

		var closing = false;
		process.on('SIGINT', function() {
			if (closing) return;
			clearInterval(interval);
			log('Shutting down...\n');
			closing = true;
			engine.destroy(function() {
				proc.fork(path.join(__dirname, 'destroy.js'), [mnt, ''+process.pid]);
			});
		});

		process.on('SIGTERM', function() {
			process.exit();
		});
	});
});