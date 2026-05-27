const SpotifyUrlInfo = require('spotify-url-info');
const { getData, getTracks } = SpotifyUrlInfo(fetch);

function isSpotifyURL(str) {
  return /^https?:\/\/(open\.)?spotify\.com\/(track|playlist|album)\//.test(str);
}

function getSpotifyType(url) {
  const m = url.match(/spotify\.com\/(track|playlist|album)\//);
  return m ? m[1] : null;
}

function extractArtist(t) {
  if (Array.isArray(t.artists) && t.artists.length > 0) {
    return t.artists.map(a => a.name).join(', ');
  }
  return t.artist || '';
}

async function getTrackMeta(url) {
  const data = await getData(url);
  return {
    title: data.name,
    artist: extractArtist(data),
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
      artist: extractArtist(t),
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
      artist: extractArtist(t),
      thumbnail: info.images?.[0]?.url || null,
      duration: Math.round((t.duration_ms || 0) / 1000),
    })),
  };
}

module.exports = { isSpotifyURL, getSpotifyType, getTrackMeta, resolveSpotifyPlaylist, resolveSpotifyAlbum };
