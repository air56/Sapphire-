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

test('startSapphireSmtc reads initial properties and reacts to changed signals', async () => {
  const mediaSignals = [];
  const playbackSignals = [];
  const bridge = {
    smtcMediaInfo: media,
    smtcPlaybackStatus: playing,
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
    QWebChannel: FakeQWebChannel
  });
  channelCallback({ objects: { bridge } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(handle.connected, true);
  assert.equal(updates.length, 1);
  mediaSignals[0]();
  playbackSignals[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates.length, 3);
  handle.dispose();
});
