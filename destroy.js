var rimraf = require('rimraf')
var fuse = require('fuse-bindings')

var mnt = process.argv[2]
var pid = Number(process.argv[3])

fuse.unmount(mnt, function () {
  rimraf.sync(mnt)
  process.kill(pid, 'SIGTERM')
})
