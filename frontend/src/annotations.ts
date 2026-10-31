import type {Batch, Page, Region, RegionPayload, Kind} from './api';

export type Box = Pick<RegionPayload, 'x1'|'y1'|'x2'|'y2'>;
export const academic = (kind: Kind) => kind === 'respuesta' || kind === 'subpregunta';
export function questionOrder(batch: Batch, page: Page, question: string, exclude?: string) {
 const orders = batch.pages.filter(p => p.exam_id === page.exam_id).flatMap(p => p.regions)
  .filter(r => academic(r.kind) && r.question_id === question && r.id !== exclude).map(r => r.reading_order || 0);
 return Math.max(0, ...orders) + 1;
}
export function containingAnswer(page: Page, box: Box): Region | undefined {
 return page.regions.filter(r => r.kind === 'respuesta' && r.x1 <= box.x1 && r.y1 <= box.y1 && r.x2 >= box.x2 && r.y2 >= box.y2)
  .sort((a,b) => (a.x2-a.x1)*(a.y2-a.y1)-(b.x2-b.x1)*(b.y2-b.y1))[0];
}
export function identifiers(initial: string[], existing: (string|null)[]) {
 return [...new Set([...initial, ...existing.filter((s): s is string => !!s)])].sort((a,b)=>a.localeCompare(b, 'es', {numeric:true}));
}

// Subquestions always receive hit tests before their containing answers.
export function regionStack(a: Region, b: Region, selected: string|null) {
 return Number(a.kind === 'subpregunta') - Number(b.kind === 'subpregunta') ||
  (a.id === selected ? 1 : b.id === selected ? -1 :
   (b.x2-b.x1)*(b.y2-b.y1)-(a.x2-a.x1)*(a.y2-a.y1));
}
