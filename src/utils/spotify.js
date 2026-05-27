const SpotifyUrlInfo = require('spotify-url-info');
const { getData, getTracks } = SpotifyUrlInfo(fetch);

function isSpotifyURL(str) {
  return /^https?:\/\/(open\.)?spotify\.com\/(track|playlist|album)\//.test(str);
}

function getSpotifyType(url) {
  const m = url.match(/spotify\.com\/(track|playlist|album)\//);
  return m ? m[1] : null;
}

async function getTrackMeta(url) {
  const data = await getData(url);
  return {
    title: data.name,
    artist: data.artists?.map(a => a.name).join(', ') || '',
    thumbnail: data.album?.images?.[0]?.url || null,
    duration: Math.round((data.duration_ms || 0) / 1000),
  };
}

async function resolveSpotifyPlaylist(url) {
  const [info, tracks] = await Promise.all([getData(url), getTracks(url)]);
  return {
    playlistName: info.name || 'Spotify Playlist',
    tracks: tracks.map(t => ({
      title: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || '',
      thumbnail: t.album?.images?.[0]?.url || null,
      duration: Math.round((t.duration_ms || 0) / 1000),
    })),
  };
}

async function resolveSpotifyAlbum(url) {
  const [info, tracks] = await Promise.all([getData(url), getTracks(url)]);
  return {
    playlistName: info.name || 'Spotify Albüm',
    tracks: tracks.map(t => ({
      title: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || '',
      thumbnail: info.images?.[0]?.url || null,
      duration: Math.round((t.duration_ms || 0) / 1000),
    })),
  };
}

module.exports = { isSpotifyURL, getSpotifyType, getTrackMeta, resolveSpotifyPlaylist, resolveSpotifyAlbum };
