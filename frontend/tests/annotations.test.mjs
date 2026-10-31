import test from 'node:test';
import assert from 'node:assert/strict';
import {questionOrder, containingAnswer, identifiers, regionStack} from '../src/annotations.ts';

const answer = (id,question,reading_order,box={x1:0,y1:0,x2:200,y2:200}) => ({id,kind:'respuesta',question_id:question,reading_order,...box});
test('reading sequences are independent per question and student, spanning pages',()=>{
 const page={exam_id:'EX_1',regions:[answer('a','P1',3), answer('b','P2',1)]};
 const batch={pages:[page,{exam_id:'EX_1',regions:[{...answer('c','P1',4),kind:'subpregunta'}]}, {exam_id:'EX_2',regions:[answer('d','P1',20)]}]};
 assert.equal(questionOrder(batch,page,'P1'),5);
 assert.equal(questionOrder(batch,page,'P2'),2);
 assert.equal(questionOrder(batch,page,'P3'),1);
 assert.equal(questionOrder(batch,page,'P1','c'),4);
});
test('a contained subquestion inherits the smallest containing answer',()=>{
 const page={regions:[answer('outer','P1',1),answer('inner','P2',1,{x1:20,y1:20,x2:100,y2:100})]};
 assert.equal(containingAnswer(page,{x1:30,y1:30,x2:80,y2:80}).question_id,'P2');
 assert.equal(containingAnswer(page,{x1:150,y1:150,x2:230,y2:230}),undefined);
});
test('question selectors preserve existing labels and sort numerically',()=>{
 assert.deepEqual(identifiers(['P1','P2','P3'],['P10','P2',null]),['P1','P2','P3','P10']);
});

test('subquestions stay above answers even when the answer is selected',()=>{
 const parent=answer('parent','P1',1);
 const child={...answer('child','P1',2,{x1:20,y1:20,x2:100,y2:100}),kind:'subpregunta'};
 for(const selected of [null,'parent','child']){
  assert.deepEqual([child,parent].sort((a,b)=>regionStack(a,b,selected)).map(r=>r.id),['parent','child']);
 }
});
