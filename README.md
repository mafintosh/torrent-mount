# torrent-mount

Mount a torrent (or magnet link) as a filesystem in real time using [torrent-stream](https://github.com/mafintosh/torrent-stream) and fuse.

AKA MAD SCIENCE!

	npm install -g torrent-mount

You also need to install fuse. See [this link](https://github.com/bcle/fuse4js#requirements) for more info.

## Usage

Open a terminal and cd to a directory where you want to mount your torrent

	torrent-mount magnet:?xt=urn:btih:ef330b39f4801d25b4245212e75a38634bfc856e

After doing that open the same directory using a file browser.
The files of the torrent should be mounted there now and you should be able to double-click them to start streaming as regular files!

![MIND BLOWN](http://i.imgur.com/C4buo.gif)

## Troubleshoot

Download the latest osxfuse `dmg` using this link and install it

http://sourceforge.net/projects/osxfuse/files/latest/download?source=files
	
The one provided by brew doesn't always seem to work. You also need pkg-config:

	brew install pkg-config

## License

MIT
