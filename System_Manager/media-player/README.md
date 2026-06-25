# Media Player

This folder holds local audio and video files for the app-wide media player in the header.

## How It Works

The Fusion Studio media player lives in the app header, outside of any workspace. It can play from:
- **Spotify** — via Connectors panel OAuth
- **Apple Music** — via Connectors panel Apple ID
- **YouTube** — direct stream or embed
- **Local Storage** — files dropped into this folder
- **Media Studio** — video/audio editor previews

Drop files into `media/` and they appear in the local source automatically. No import step.

## Folder Structure

```
media-player/
├── media/           # Your audio/video files
│   ├── podcasts/
│   ├── music/
│   └── audiobooks/
├── README.md        # This file
└── playlists.json   # User-created playlists (auto-generated)
```

## Supported Formats

| Audio | Video |
|-------|-------|
| MP3 | MP4 |
| AAC | MOV |
| FLAC | WebM |
| WAV | MKV |
| OGG | AVI |
| M4A | |

## Preemption Rules

When multiple sources want to play at once, priority wins:

1. **User explicit action** — clicking play anywhere
2. **Media Studio workspace** — video/audio editor timeline preview
3. **View-specific media** — embedded video in a wiki page or doc
4. **System media player** — the header player (lowest priority)

Lower-priority sources **pause**, they don't stop. When higher-priority playback ends, lower-priority sources **resume** from where they left off.

## Adding Files

1. Drop audio/video files into `media/` or any subfolder
2. Open the media player (click header widget or press `Cmd+Shift+M`)
3. Select "Local Storage" as the source
4. Files appear immediately

## Removing Files

Delete from `media/` folder. Playlists referencing deleted files are cleaned up on next app launch.
