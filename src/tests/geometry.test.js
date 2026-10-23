import test from 'node:test';
import assert from 'node:assert/strict';
import {angle} from '../geometry.js';
test('angles handle straight, right and degenerate vectors',()=>{assert.equal(angle({x:0,y:1},{x:0,y:0},{x:1,y:0}),90);assert.equal(angle({x:0,y:1},{x:0,y:0},{x:0,y:-1}),180);assert.equal(angle({x:0,y:0},{x:0,y:0},{x:1,y:0}),null);});
