import type {Batch,Page,Region,RegionPayload} from './api';

export type GradeScope='pregunta'|'inciso';
export function gradeProblem(r: Pick<RegionPayload,'kind'|'scope'|'question_id'|'subquestion_id'|'score_value'|'score_denominator'>): string|null {
 if(r.kind!=='calificacion')return null;
 if(!r.question_id||r.scope!=='pregunta'&&r.scope!=='inciso')return 'Asigná una pregunta o un inciso';
 if(r.scope==='inciso'&&!r.subquestion_id)return 'Falta el inciso';
 if(r.score_value==null||r.score_denominator==null)return 'Falta valor o denominador';
 if(!Number.isFinite(r.score_value)||!Number.isFinite(r.score_denominator)||r.score_value<0||r.score_denominator<=0||r.score_value>r.score_denominator)return 'El valor debe estar entre cero y el denominador';
 return null;
}
export function previousDenominator(batch:Batch,page:Page,scope:GradeScope,question:string,inciso:string|null):number|null {
 const previous=batch.pages.filter(p=>p.page_index<page.page_index&&p.exam_id!==page.exam_id).flatMap(p=>p.regions)
  .filter(r=>r.kind==='calificacion'&&r.scope===scope&&r.question_id===question&&(scope!=='inciso'||r.subquestion_id===inciso)&&r.score_denominator!=null);
 return previous.at(-1)?.score_denominator??null;
}
export function nextGradeTarget(batch:Batch,page:Page,scope:GradeScope,selected:Region|null) {
 const grades=batch.pages.filter(p=>p.exam_id===page.exam_id).flatMap(p=>p.regions).filter(r=>r.kind==='calificacion');
 if(scope==='pregunta'){
  const numbers=grades.filter(r=>r.scope==='pregunta').map(r=>/^P([1-9]\d*)$/.exec(r.question_id||'')).filter(r=>r!==null).map(r=>Number(r[1]));
  return {question:`P${Math.max(0,...numbers)+1}`,inciso:null};
 }
 const question=selected?.question_id||'P1';
 const used=new Set(grades.filter(r=>r.scope==='inciso'&&r.question_id===question).map(r=>r.subquestion_id));
 // Reuse the same alphabetic successor as student subquestions, scoped to teacher grades.
 const labels=[...used].filter((s):s is string=>!!s&&/^[a-z]+$/.test(s)).sort((a,b)=>a.length-b.length||a.localeCompare(b));
 const letters=(labels.at(-1)||'').split('');
 for(let i=letters.length-1;i>=0;i--){if(letters[i]!=='z'){letters[i]=String.fromCharCode(letters[i].charCodeAt(0)+1);return {question,inciso:letters.join('')}}letters[i]='a'}
 return {question,inciso:'a'+letters.join('')};
}
