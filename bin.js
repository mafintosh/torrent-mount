#!/usr/bin/env node

var drive = require('./')
var readTorrent = require('read-torrent')
var log = require('single-line-log').stdout
var prettysize = require('prettysize')
var fuse = require('fuse-bindings')
var fs = require('fs')
var minimist = require('minimist')

var argv = minimist(process.argv.slice(2), {
  alias: {mount: 'm', lazy: 'l'},
  boolean: ['lazy']
})

if (!argv._[0]) {
  console.error('Usage: torrent-mount torrent_or_magnet_link [directory]')
  console.error()
  console.error('  --mount,  -m   Mount location path [directory]')
  console.error('  --lazy,   -l   Download files only if accessed')
  console.error()
  process.exit(1)
}

readTorrent(argv._[0], function (err, torrent, raw) {
  if (err) {
    console.error(err.message)
    process.exit(2)
  }

  var mnt = fs.realpathSync(argv.mount || '.')
  var isLazy = argv.lazy
  var engine = drive(raw, mnt, isLazy)
  var hs = 0

  engine.on('hotswap', function () {
    hs++
  })

  log('Initializing swarm and verifying data...\n')
  engine.on('mount', function (mnt) {
    log('Mounted ' + engine.files.length + ' files, ' + prettysize(engine.torrent.length) + ' in ' + engine.torrent.name)
    log.clear()

    var notChoked = function (result, wire) {
      return result + (wire.peerChoking ? 0 : 1)
    }

    var status = function () {
      var down = prettysize(engine.swarm.downloaded)
      var downSpeed = prettysize(engine.swarm.downloadSpeed()).replace('Bytes', 'b') + '/s'
      var up = prettysize(engine.swarm.uploaded)
      var upSpeed = prettysize(engine.swarm.uploadSpeed()).replace('Bytes', 'b') + '/s'

      log(
        'Connected to ' + engine.swarm.wires.reduce(notChoked, 0) + '/' + engine.swarm.wires.length + ' peers\n' +
        'Downloaded ' + down + ' (' + downSpeed + ') with ' + hs + ' hotswaps\n' +
        'Uploaded ' + up + ' (' + upSpeed + ')\n'
      )
    }

    var interval = setInterval(status, 500)
    status()

    var exit = function () {
      setTimeout(process.kill.bind(process, process.pid), 2000).unref()
      process.removeListener('SIGINT', exit)
      process.removeListener('SIGTERM', exit)
      log('Shutting down...\n')
      clearInterval(interval)
      fuse.unmount(mnt, function () {
        fs.rmdir(mnt, function () {
          process.exit()
        })
      })
    }

    process.on('SIGINT', exit)
    process.on('SIGTERM', exit)
  })
})
