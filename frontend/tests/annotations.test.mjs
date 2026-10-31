import test from 'node:test';
import assert from 'node:assert/strict';
import {questionOrder, containingAnswer, identifiers, regionStack, clampBox, nextQuestion, nextSubquestion} from '../src/annotations.ts';

const answer = (id,question,reading_order,box={x1:0,y1:0,x2:200,y2:200}) => ({id,kind:'respuesta',question_id:question,reading_order,...box});
test('reading sequences are independent per question and student, spanning pages',()=>{
 const page={exam_id:'EX_1',regions:[answer('a','P1',3), answer('b','P2',1)]};
 const batch={pages:[page,{exam_id:'EX_1',regions:[answer('c','P1',4)]}, {exam_id:'EX_2',regions:[answer('d','P1',20)]}]};
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
 {
  assert.deepEqual([child,parent].sort((a,b)=>regionStack(a,b)).map(r=>r.id),['parent','child']);
 }
});

test('response and each subquestion have independent fragment sequences',()=>{
 const page={exam_id:'EX_1',regions:[answer('p1','P1',3),
  {...answer('a1','P1',1),kind:'subpregunta',subquestion_id:'a'},
  {...answer('a2','P1',2),kind:'subpregunta',subquestion_id:'a'},
  {...answer('b1','P1',7),kind:'subpregunta',subquestion_id:'b'}]};
 const batch={pages:[page]};
 assert.equal(questionOrder(batch,page,'P1'),4);
 assert.equal(questionOrder(batch,page,'P1',undefined,'subpregunta','a'),3);
 assert.equal(questionOrder(batch,page,'P1',undefined,'subpregunta','b'),8);
 assert.equal(questionOrder(batch,page,'P1',undefined,'subpregunta','c'),1);
 assert.equal(questionOrder(batch,page,'P1','a2','subpregunta','a'),2);
});
test('selected peer does not change the stacking of nearby subquestions',()=>{
 const regions=['one','two'].map(id=>({...answer(id,'P1',1),kind:'subpregunta'}));
 assert.deepEqual([...regions].sort(regionStack).map(r=>r.id),['one','two']);
});
test('resizing clips to page edges without creating zero size rectangles',()=>{
 assert.deepEqual(clampBox({x1:-20,y1:-5,x2:500,y2:400},200,300),{x1:0,y1:0,x2:200,y2:300});
 assert.deepEqual(clampBox({x1:200,y1:300,x2:200,y2:300},200,300),{x1:197,y1:297,x2:200,y2:300});
});

test('new answers advance the question across pages of the same exam',()=>{
 const page={exam_id:'EX_1',regions:[answer('p1','P1',1)]};
 const batch={pages:[page,{exam_id:'EX_1',regions:[answer('p3','P3',1)]},
  {exam_id:'EX_2',regions:[answer('other','P20',1)]}]};
 assert.equal(nextQuestion(batch,page),'P4');
 assert.equal(nextQuestion({pages:[]},page),'P1');
 assert.equal(nextQuestion(batch,{exam_id:'EX_3'}),'P1');
});
test('subquestion identifiers advance within a question and student, including z to aa',()=>{
 const page={exam_id:'EX_1',regions:[
  {...answer('a','P1',1),kind:'subpregunta',subquestion_id:'a'},
  {...answer('z','P1',1),kind:'subpregunta',subquestion_id:'z'},
  {...answer('other','P2',1),kind:'subpregunta',subquestion_id:'zz'}]};
 assert.equal(nextSubquestion({pages:[page]},page,'P1'),'aa');
 assert.equal(nextSubquestion({pages:[page]},page,'P3'),'a');
 page.regions.push({...answer('aa','P1',1),kind:'subpregunta',subquestion_id:'aa'});
 assert.equal(nextSubquestion({pages:[page]},page,'P1'),'ab');
});
