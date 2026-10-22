import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {normalizePhoto} from "../../platform/assessment/storage";
test("uploads decode and normalize photos, strip metadata and reject non-images",async()=>{
 const png=await sharp({create:{width:160,height:120,channels:3,background:"white"}}).png().withMetadata({exif:{IFD0:{Artist:"test metadata"}}}).toBuffer();
 const cleaned=await normalizePhoto(png);const meta=await sharp(cleaned.bytes).metadata();assert.equal(meta.format,"jpeg");assert.equal(meta.exif,undefined);assert.equal(cleaned.hash.length,64);assert.deepEqual(cleaned.quality?.warnings,["LOW_RESOLUTION","LOW_CONTRAST"]);
 await assert.rejects(normalizePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),/INVALID_PHOTO/);
 await assert.rejects(normalizePhoto(Buffer.alloc(2097153)),/PHOTO_TOO_LARGE/);
 await assert.rejects(normalizePhoto(Buffer.from([255,216,255,0])),/INVALID_PHOTO/);
 const tiny=await sharp({create:{width:20,height:20,channels:3,background:"white"}}).png().toBuffer();await assert.rejects(normalizePhoto(tiny),/INVALID_PHOTO/);
});
