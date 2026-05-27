const SpotifyWebApi = require('spotify-web-api-node');

const spotify = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpiresAt = 0;

async function ensureToken() {
  if (Date.now() < tokenExpiresAt - 10000) return;
  const data = await spotify.clientCredentialsGrant();
  spotify.setAccessToken(data.body.access_token);
  tokenExpiresAt = Date.now() + data.body.expires_in * 1000;
}

function isSpotifyURL(str) {
  return /^https?:\/\/(open\.)?spotify\.com\/(track|playlist|album)\//.test(str);
}

function getSpotifyType(url) {
  const m = url.match(/spotify\.com\/(track|playlist|album)\//);
  return m ? m[1] : null;
}

function extractId(url) {
  const m = url.match(/spotify\.com\/(?:track|playlist|album)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

async function getTrackMeta(trackId) {
  await ensureToken();
  const { body } = await spotify.getTrack(trackId);
  return {
    title: body.name,
    artist: body.artists.map(a => a.name).join(', '),
    thumbnail: body.album?.images?.[0]?.url || null,
    duration: Math.round(body.duration_ms / 1000),
  };
}

async function getPlaylistTracks(playlistId) {
  await ensureToken();
  const tracks = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const { body } = await spotify.getPlaylistTracks(playlistId, {
      limit, offset,
      fields: 'items(track(name,artists,album(images),duration_ms)),next',
    });
    for (const item of body.items) {
      if (!item.track) continue;
      tracks.push({
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        thumbnail: item.track.album?.images?.[0]?.url || null,
        duration: Math.round(item.track.duration_ms / 1000),
      });
    }
    if (!body.next) break;
    offset += limit;
  }
  return tracks;
}

async function resolveSpotifyPlaylist(url) {
  const id = extractId(url);
  await ensureToken();
  const { body } = await spotify.getPlaylist(id, { fields: 'name' });
  const tracks = await getPlaylistTracks(id);
  return { playlistName: body.name, tracks };
}

async function getAlbumTracks(albumId) {
  await ensureToken();
  const tracks = [];
  let offset = 0;
  const limit = 50;
  const { body: albumBody } = await spotify.getAlbum(albumId);
  const thumbnail = albumBody.images?.[0]?.url || null;
  while (true) {
    const { body } = await spotify.getAlbumTracks(albumId, { limit, offset });
    for (const track of body.items) {
      tracks.push({
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        thumbnail,
        duration: Math.round(track.duration_ms / 1000),
      });
    }
    if (!body.next) break;
    offset += limit;
  }
  return tracks;
}

async function resolveSpotifyAlbum(url) {
  const id = extractId(url);
  await ensureToken();
  const { body } = await spotify.getAlbum(id);
  const tracks = await getAlbumTracks(id);
  return { playlistName: body.name, tracks };
}

module.exports = {
  isSpotifyURL,
  getSpotifyType,
  extractId,
  getTrackMeta,
  resolveSpotifyPlaylist,
  resolveSpotifyAlbum,
};
