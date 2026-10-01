import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {classifyMediaRequest}=require('../desktop/media-permission.cjs');
test('Electron 44 screen request reaches the picker instead of being rejected as a device request',()=>{
 assert.equal(classifyMediaRequest('media',{mediaTypes:[]}), 'display');
 assert.equal(classifyMediaRequest('display-capture',{}), 'display');
});
test('Microphone and camera continue through saved device consent',()=>{
 for(const mediaTypes of [['audio'],['video'],['audio','video']])assert.equal(classifyMediaRequest('media',{mediaTypes}), 'device');
});
test('Missing, malformed, and unrelated requests remain denied',()=>{
 for(const details of [{},null,{mediaTypes:'video'},{mediaTypes:['unknown']},{mediaTypes:['audio','other']}])assert.equal(classifyMediaRequest('media',details),'deny');
 assert.equal(classifyMediaRequest('notifications',{mediaTypes:[]}), 'deny');
});
