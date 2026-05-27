const { createAudioPlayer } = require('@discordjs/voice');

class MusicQueue {
  constructor(guildId, textChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;
    this.songs = [];
    this.currentSong = null;
    this.voiceConnection = null;
    this.audioPlayer = createAudioPlayer();
    this.paused = false;
    this.currentProcess = null; // aktif yt-dlp process
  }

  addSong(song) {
    this.songs.push(song);
  }

  addSongs(songs) {
    this.songs.push(...songs);
  }

  shiftSong() {
    return this.songs.shift() || null;
  }

  killCurrentProcess() {
    if (this.currentProcess) {
      try { this.currentProcess.kill('SIGKILL'); } catch (_) {}
      this.currentProcess = null;
    }
  }

  clear() {
    this.songs = [];
    this.currentSong = null;
  }

  destroy() {
    this.killCurrentProcess();
    this.clear();
    this.audioPlayer.removeAllListeners();
    this.audioPlayer.stop(true);
    if (this.voiceConnection) {
      try { this.voiceConnection.destroy(); } catch (_) {}
      this.voiceConnection = null;
    }
  }
}

module.exports = MusicQueue;
