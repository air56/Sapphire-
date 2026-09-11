import test from 'node:test';
import assert from 'node:assert/strict';
import { createSapphireSmtcUpdate, isNeteaseApplicationName } from '../sapphire-smtc.js';

const media = JSON.stringify({
  enabled: true,
  mediaTitle: '真夜中のドア〜stay with me',
  mediaArtist: '松原みき',
  mediaAlbum: 'Pocket Park',
  appName: '网易云音乐'
});

const playing = JSON.stringify({
  enabled: true,
  playbackStatus: 'Playing',
  playbackPosition: 42000,
  playbackDuration: 279000
});

test('creates a bridge media update from Sapphire SMTC JSON', () => {
  const update = createSapphireSmtcUpdate(media, playing, new Date('2026-09-11T03:00:00.000Z'));

  assert.deepEqual(update, {
    sourceAppUserModelId: '网易云音乐',
    title: '真夜中のドア〜stay with me',
    artists: ['松原みき'],
    album: 'Pocket Park',
    durationMs: 279000,
    state: 'Playing',
    positionMs: 42000,
    updatedAt: '2026-09-11T03:00:00.000Z'
  });
});

test('only accepts known NetEase application names', () => {
  assert.equal(isNeteaseApplicationName('网易云音乐'), true);
  assert.equal(isNeteaseApplicationName('com.netease.cloudmusic'), true);
  assert.equal(isNeteaseApplicationName('Spotify'), false);

  const foreignMedia = JSON.stringify({
    enabled: true,
    mediaTitle: 'Other song',
    mediaArtist: 'Other artist',
    appName: 'Spotify'
  });
  assert.equal(createSapphireSmtcUpdate(foreignMedia, playing), null);
});

test('recognizes media as soon as Sapphire publishes it, even before playback status is ready', () => {
  const update = createSapphireSmtcUpdate(
    JSON.stringify({
      enabled: true,
      mediaTitle: '先行者',
      mediaArtist: '歌手',
      mediaAlbum: '专辑',
      appName: 'CloudMusic.exe'
    }),
    null,
    new Date('2026-09-11T05:00:00.000Z')
  );

  assert.deepEqual(update, {
    sourceAppUserModelId: 'CloudMusic.exe',
    title: '先行者',
    artists: ['歌手'],
    album: '专辑',
    durationMs: 0,
    state: 'Stopped',
    positionMs: 0,
    updatedAt: '2026-09-11T05:00:00.000Z'
  });
});

test('rejects unusable Sapphire SMTC payloads and clamps negative timeline values', () => {
  assert.equal(createSapphireSmtcUpdate('{nope', playing), null);
  assert.equal(createSapphireSmtcUpdate(JSON.stringify({ enabled: false }), playing), null);
  assert.equal(createSapphireSmtcUpdate(JSON.stringify({ enabled: true, appName: '网易云音乐' }), playing), null);

  const update = createSapphireSmtcUpdate(
    JSON.stringify({ enabled: true, mediaTitle: 'Song', mediaArtist: '', appName: '网易云音乐' }),
    JSON.stringify({ enabled: true, playbackStatus: 'Paused', playbackPosition: -1, playbackDuration: -9 }),
    new Date('2026-09-11T04:00:00.000Z')
  );

  assert.deepEqual(update, {
    sourceAppUserModelId: '网易云音乐',
    title: 'Song',
    artists: [],
    album: null,
    durationMs: 0,
    state: 'Paused',
    positionMs: 0,
    updatedAt: '2026-09-11T04:00:00.000Z'
  });
});

test('startSapphireSmtc waits for Sapphire reactive properties before its first read and reacts to signals', async () => {
  const mediaSignals = [];
  const playbackSignals = [];
  const timers = [];
  const bridge = {
    smtcMediaInfo: null,
    smtcPlaybackStatus: null,
    smtcMediaInfoChanged: { connect: (handler) => mediaSignals.push(handler) },
    smtcPlaybackStatusChanged: { connect: (handler) => playbackSignals.push(handler) }
  };
  const updates = [];
  let channelCallback;
  class FakeQWebChannel {
    constructor(_transport, callback) {
      channelCallback = callback;
    }
  }

  const { startSapphireSmtc } = await import('../sapphire-smtc.js');
  const handle = startSapphireSmtc((update) => updates.push(update), {
    qt: { webChannelTransport: {} },
    QWebChannel: FakeQWebChannel,
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    }
  });
  channelCallback({ objects: { bridge } });

  assert.equal(handle.connected, true);
  assert.equal(updates.length, 0);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 200);

  bridge.smtcMediaInfo = media;
  bridge.smtcPlaybackStatus = playing;
  timers[0].callback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates.length, 1);

  mediaSignals[0]();
  playbackSignals[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates.length, 3);
  handle.dispose();
});
