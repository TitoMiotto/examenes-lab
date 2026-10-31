export type Kind = 'respuesta' | 'subpregunta' | 'calificacion' | 'observacion' | 'privacidad';
export type Scope = 'examen' | 'pregunta' | 'inciso';
export type Region = {
  id:string; page_id:string; kind:Kind;
  x1:number;y1:number;x2:number;y2:number;
  question_id:string|null; subquestion_id:string|null;
  reading_order:number|null; scope:Scope|null;
  value_text:string|null; note_text:string|null; updated_at:string;
}
export type Page = {
 id:string; batch_id:string;page_index:number;width:number;height:number;rotation:number;
 is_exam_start:number;exam_id:string;exam_page_index:number;regions:Region[];
}
export type Batch = {id:string;pages_count:number;dpi:number;created_at:string;exams_count:number;pages:Page[];}
export type BatchSummary = {id:string;pages_count:number;dpi:number;created_at:string;}
export type RegionPayload = Omit<Region,'id'|'page_id'|'updated_at'>;
export type ExportResult = {export_id:string;file_count:number;regions_count:number;exams_count:number;download_url:string;}

async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const resp=await fetch(url,init);
 if(!resp.ok){let msg=`Error ${resp.status}`;try {const j=await resp.json(); msg=typeof j.detail==='string'?j.detail:JSON.stringify(j.detail)}catch{} throw new Error(msg)}
 return resp.json() as Promise<T>;
}
const json = (body:unknown) => ({headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const api = {
 list:()=>request<BatchSummary[]>('/api/batches'),
 get:(id:string)=>request<Batch>(`/api/batches/${id}`),
 async upload(file:File,dpi:number){const data=new FormData();data.append('file',file);return request<{id:string;pages_count:number}>(`/api/batches?dpi=${dpi}`,{method:'POST',body:data})},
 boundaries:(id:string,starts:number[])=>request<Batch>(`/api/batches/${id}/boundaries`,{method:'PUT',...json({starts})}),
 rotate:(id:string,n:number,clockwise:boolean)=>request<Batch>(`/api/batches/${id}/pages/${n}/rotate?clockwise=${clockwise}`,{method:'POST'}),
 createRegion:(id:string,n:number,region:RegionPayload)=>request<{id:string}>(`/api/batches/${id}/pages/${n}/regions`,{method:'POST',...json(region)}),
 updateRegion:(id:string,rid:string,region:RegionPayload)=>request<{ok:boolean}>(`/api/batches/${id}/regions/${rid}`,{method:'PUT',...json(region)}),
 deleteRegion:(id:string,rid:string)=>request<{ok:boolean}>(`/api/batches/${id}/regions/${rid}`,{method:'DELETE'}),
 export:(id:string,mode:'completo'|'ocr')=>request<ExportResult>(`/api/batches/${id}/exports`,{method:'POST',...json({mode,privacy_reviewed:true})}),
 image:(id:string,n:number,thumb=false,masked=false)=>`/api/batches/${id}/pages/${n}/image?thumb=${thumb}&masked=${masked}`,
};
