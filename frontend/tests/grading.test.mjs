import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeProblem,nextGradeTarget,previousDenominator,coveringGrades} from '../src/grading.ts';
const grade=(question,scope='pregunta',inciso=null,denominator=10)=>({kind:'calificacion',question_id:question,scope,subquestion_id:inciso,score_value:0,score_denominator:denominator});
const first={exam_id:'EX_1',page_index:0,regions:[grade('P1'),grade('P2','pregunta',null,5),grade('P1','inciso','a',3)]};
const second={exam_id:'EX_2',page_index:1,regions:[]};
const later={exam_id:'EX_3',page_index:2,regions:[grade('P1','pregunta',null,99)]};
test('denominators are reused only for the same field in earlier exams of this batch',()=>{
 const batch={pages:[first,second,later]};
 assert.equal(previousDenominator(batch,second,'pregunta','P1',null),10);
 assert.equal(previousDenominator(batch,second,'pregunta','P2',null),5);
 assert.equal(previousDenominator(batch,second,'inciso','P1','a'),3);
 assert.equal(previousDenominator(batch,second,'inciso','P1','b'),null);
 assert.equal(previousDenominator(batch,first,'pregunta','P1',null),null);
});
test('teacher question/inciso counters are independent of student regions and reset per exam',()=>{
 const batch={pages:[first,second]};
 first.regions.push({kind:'respuesta',question_id:'P20'});
 assert.deepEqual(nextGradeTarget(batch,first,'pregunta',null),{question:'P3',inciso:null});
 assert.deepEqual(nextGradeTarget(batch,second,'pregunta',null),{question:'P1',inciso:null});
 assert.deepEqual(nextGradeTarget(batch,first,'inciso',grade('P1','inciso','a')),{question:'P1',inciso:'b'});
});
test('scores require a field and both numbers; zero is a valid obtained value',()=>{
 assert.equal(gradeProblem(grade('P1')),null);
 for(const change of [{scope:'examen'},{question_id:null},{scope:'inciso'}, {score_value:null},
  {score_denominator:null},{score_denominator:0},{score_value:11}]){
  assert.ok(gradeProblem({...grade('P1'),...change}),JSON.stringify(change));
 }
 assert.equal(gradeProblem({kind:'respuesta'}),null);
});

test('all fragments share the field grade and incisos may inherit the question grade',()=>{
 const response={kind:'respuesta',question_id:'P1'};
 const sub={kind:'subpregunta',question_id:'P1',subquestion_id:'a'};
 const parent=grade('P1');
 const own=grade('P1','inciso','a',3);
 const page={exam_id:'EX_1',regions:[parent]};
 const batch={pages:[page,{exam_id:'EX_2',regions:[grade('P2')]}]};
 assert.deepEqual(coveringGrades(batch,page,response),[parent]);
 assert.deepEqual(coveringGrades(batch,page,sub),[parent]);
 page.regions.push(own);
 assert.deepEqual(coveringGrades(batch,page,sub),[own]);
 assert.deepEqual(coveringGrades(batch,page,{...response,question_id:'P2'}),[]);
});
