import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAssetUrl, parseCaptions, pickVideoFiles } from "../services/study/video";
import { TRACKS } from "../services/study/tracks";

test("parseCaptions lê SRT e WebVTT", () => {
  const srt = "1\r\n00:00:01,500 --> 00:00:04,000\r\nHello <i>Earth</i>\r\n\r\n2\r\n00:01:02,000 --> 00:01:05,250\r\nSecond line\r\ncontinues\r\n";
  assert.deepEqual(parseCaptions(srt), [
    { start: 1.5, end: 4, text: "Hello Earth" },
    { start: 62, end: 65.25, text: "Second line continues" }
  ]);
  const vtt = "WEBVTT\n\n00:00.000 --> 00:02.000\nShort form\n\nNOTE x\n\n01:00:00.000 --> 01:00:01.000 align:start\nHour";
  assert.deepEqual(parseCaptions(vtt).map((c) => [c.start, c.text]), [[0, "Short form"], [3600, "Hour"]]);
});

test("pickVideoFiles ordena mp4 do mais leve ao original e força https", () => {
  const f = pickVideoFiles([
    "http://images-assets.nasa.gov/video/X/X~orig.mp4", "http://images-assets.nasa.gov/video/X/X~small.mp4",
    "http://images-assets.nasa.gov/video/X/X.srt", "http://images-assets.nasa.gov/video/X/X~medium.mp4",
    "http://images-assets.nasa.gov/video/X/metadata.json"
  ]);
  assert.deepEqual(f.map((x) => x.label), ["small", "medium", "orig"]);
  assert.ok(f.every((x) => x.url.startsWith("https://")));
  assert.equal(normalizeAssetUrl("http://a.gov/v/My Video~orig.mp4"), "https://a.gov/v/My%20Video~orig.mp4");
});

test("trilhas: ids únicos e só links https", () => {
  assert.equal(new Set(TRACKS.map((t) => t.id)).size, TRACKS.length);
  for (const t of TRACKS) for (const r of t.readings) assert.match(r.url, /^https:\/\//);
});
