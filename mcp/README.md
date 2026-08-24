# youtube-music-cli MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
`youtube-music-cli`'s playlist, search, download, and import/export
capabilities to any MCP client. It runs over **stdio** and reuses the app's own
services, so it reads and writes the same config as the TUI
(`~/.youtube-music-cli/config.json`).

## Install

The server ships with the package. After a global install it is available as the
`youtube-music-cli-mcp` binary:

```bash
npm install -g @involvex/youtube-music-cli
youtube-music-cli-mcp   # runs the stdio server (waits for a client)
```

To run from source during development:

```bash
bun run dev:mcp
```

## Client configuration (generic stdio)

Any MCP client that supports stdio servers can use this config:

```json
{
	"mcpServers": {
		"youtube-music-cli": {
			"command": "youtube-music-cli-mcp"
		}
	}
}
```

If the binary is not on `PATH`, use the absolute path to the built server, e.g.
`/usr/lib/node_modules/@involvex/youtube-music-cli/dist/mcp/server.js` run with
`node`:

```json
{
	"mcpServers": {
		"youtube-music-cli": {
			"command": "node",
			"args": [
				"/usr/lib/node_modules/@involvex/youtube-music-cli/dist/mcp/server.js"
			]
		}
	}
}
```

- **Claude Desktop**: add the block above to `claude_desktop_config.json`.
- **opencode**: add it under the `mcp` key of your opencode config.

## Tools

| Tool                         | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `list_playlists`             | List saved playlists (id, name, track count)              |
| `get_playlist`               | Get one playlist with all its tracks                      |
| `create_playlist`            | Create a new empty playlist                               |
| `rename_playlist`            | Rename a playlist                                         |
| `delete_playlist`            | Delete a playlist                                         |
| `add_song_to_playlist`       | Add a song (by `videoId`) to a playlist                   |
| `remove_track_from_playlist` | Remove a track by index                                   |
| `reorder_playlist_track`     | Move a track from one index to another                    |
| `search`                     | Search YouTube Music (songs/albums/artists/playlists)     |
| `download_song`              | Download one song (by `videoId`) to the downloads folder  |
| `download_playlist`          | Download every track of a saved playlist                  |
| `export_playlist`            | Export a playlist (`json` / `m3u8` / `m3u` / `both`)      |
| `import_m3u`                 | Import a local `.m3u` / `.m3u8` file into a new playlist  |
| `import_online_playlist`     | Import a Spotify / YouTube playlist by URL or ID          |
| `list_local_music`           | Scan configured local dirs and list playable local tracks |

## Notes

- **Downloads** require the _Download_ feature enabled in the app settings and
  `ffmpeg` + `yt-dlp` installed.
- **Local music** requires a `Local Music Folder` set in settings (the downloads
  folder is included by default).
- Playlist mutations are concurrency-safe: the server re-reads `config.json`
  from disk before each write, so it will not clobber edits you make in the TUI
  at the same time.
- All responses are returned as JSON text content.
