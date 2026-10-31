import type {Batch, Page, Region, RegionPayload, Kind} from './api';

export type Box = Pick<RegionPayload, 'x1'|'y1'|'x2'|'y2'>;
export const academic = (kind: Kind) => kind === 'respuesta' || kind === 'subpregunta';
export function questionOrder(batch: Batch, page: Page, question: string, exclude?: string, kind: Kind = 'respuesta', subquestion: string|null = null) {
 const orders = batch.pages.filter(p => p.exam_id === page.exam_id).flatMap(p => p.regions)
  .filter(r => r.kind === kind && r.question_id === question && (kind !== 'subpregunta' || r.subquestion_id === subquestion) && r.id !== exclude).map(r => r.reading_order || 0);
 return Math.max(0, ...orders) + 1;
}
export function containingAnswer(page: Page, box: Box): Region | undefined {
 return page.regions.filter(r => r.kind === 'respuesta' && r.x1 <= box.x1 && r.y1 <= box.y1 && r.x2 >= box.x2 && r.y2 >= box.y2)
  .sort((a,b) => (a.x2-a.x1)*(a.y2-a.y1)-(b.x2-b.x1)*(b.y2-b.y1))[0];
}
export function identifiers(initial: string[], existing: (string|null)[]) {
 return [...new Set([...initial, ...existing.filter((s): s is string => !!s)])].sort((a,b)=>a.localeCompare(b, 'es', {numeric:true}));
}

// Keep peer stacking stable when selection changes: a pointer-down must not reorder its drag target.
export function regionStack(a: Region, b: Region) {
 return Number(a.kind === 'subpregunta') - Number(b.kind === 'subpregunta') ||
  (b.x2-b.x1)*(b.y2-b.y1)-(a.x2-a.x1)*(a.y2-a.y1);
}
export function clampBox(box: Box, width: number, height: number): Box {
 const x1=Math.max(0,Math.min(width-3,Math.round(box.x1)));
 const y1=Math.max(0,Math.min(height-3,Math.round(box.y1)));
 return {x1,y1,x2:Math.max(x1+3,Math.min(width,Math.round(box.x2))),y2:Math.max(y1+3,Math.min(height,Math.round(box.y2)))};
}

export function nextQuestion(batch: Batch, page: Page): string {
 const numbers=batch.pages.filter(p=>p.exam_id===page.exam_id).flatMap(p=>p.regions)
  .filter(r=>academic(r.kind)).map(r=>/^P([1-9]\d*)$/.exec(r.question_id||''))
  .filter((match): match is RegExpExecArray=>match!==null).map(match=>Number(match[1]));
 return `P${Math.max(0,...numbers)+1}`;
}
export function nextSubquestion(batch: Batch, page: Page, question: string): string {
 const labels=batch.pages.filter(p=>p.exam_id===page.exam_id).flatMap(p=>p.regions)
  .filter(r=>r.kind==='subpregunta'&&r.question_id===question).map(r=>r.subquestion_id||'')
  .filter(label=>/^[a-z]+$/.test(label)).sort((a,b)=>a.length-b.length||a.localeCompare(b));
 const last=labels.at(-1);if(!last)return 'a';
 const letters=last.split('');
 for(let i=letters.length-1;i>=0;i--){
  if(letters[i]!=='z'){letters[i]=String.fromCharCode(letters[i].charCodeAt(0)+1);return letters.join('')}
  letters[i]='a';
 }
 return 'a'+letters.join('');
}
