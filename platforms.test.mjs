import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identify} from '../platforms.mjs';
test('detect and normalize the four supported platforms',()=>{
 for(const [link,platform]of [['https://youtu.be/aqz-KE-bpKQ?x=1','youtube'],['https://www.youtube.com/shorts/aqz-KE-bpKQ','youtube'],['https://www.instagram.com/reel/ABC_123/','instagram'],['https://www.instagram.com/p/ABC_123/','instagram'],['https://id.pinterest.com/pin/123456789/','pinterest'],['https://pin.it/abc123','pinterest'],['https://www.tiktok.com/@creator/video/12345678','tiktok'],['https://vt.tiktok.com/ABC123/','tiktok']])assert.equal(identify(link).platform,platform);
 assert.equal(identify('https://youtu.be/aqz-KE-bpKQ?si=tracking').url,'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
});
test('reject unrelated URLs, local services, credentials, profiles and playlists',()=>{
 for(const link of ['https://127.0.0.1/','file:///tmp/a','http://youtube.com/watch?v=aqz-KE-bpKQ','https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ','https://user:pass@www.instagram.com/p/ABC/','https://www.instagram.com:9999/p/ABC/','https://www.instagram.com/creator/','https://www.pinterest.com/creator/board/','https://www.youtube.com/playlist?list=123'])assert.throws(()=>identify(link),link);
});
