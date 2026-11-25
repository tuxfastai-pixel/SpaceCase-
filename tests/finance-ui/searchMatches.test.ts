import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchParts} from '../../app/ui/search/matches';
test('search characters are literal, preserve the original text and cannot become markup',()=>{
 const text='School [A+B] <script> fee 350.00';
 const parts=searchParts(text,'[A+B] <script> 350.00');
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['[A+B]','<script>','350.00']);
 assert.equal(searchParts('School AAB','[A+B]').some(p=>p.match),false);
});
test('case-insensitive multi-word matching retains repeated occurrences and overlapping terms',()=>{
 const parts=searchParts('Anna ANNA Ann','Ann Anna');
 assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['Anna','ANNA','Ann']);
 assert.equal(parts.map(p=>p.text).join(''),'Anna ANNA Ann');
});
test('empty and unmatched searches do not invent a match',()=>{
 assert.deepEqual(searchParts('SYN-FIN-1','  '),[{text:'SYN-FIN-1',match:false}]);
 assert.deepEqual(searchParts('SYN-FIN-1','missing'),[{text:'SYN-FIN-1',match:false}]);
});
