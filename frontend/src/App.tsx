import {useEffect,useMemo,useRef,useState} from 'react';
import {Archive,ArrowLeft,CheckCircle2,ChevronLeft,ChevronRight,Download,Eye,EyeOff,FileDown,FilePlus2,FileText,Layers3,LoaderCircle,MousePointer2,RotateCcw,RotateCw,PanelLeftClose,PanelLeftOpen,Scissors,ShieldCheck,Trash2,UploadCloud, X, Info, ZoomIn, ZoomOut} from 'lucide-react';
import {api,type Batch,type BatchSummary,type Kind,type Region,type RegionPayload,type Scope} from './api';
import {gradeProblem, nextGradeTarget, previousDenominator, type GradeScope} from './grading';
import EditorCanvas,{LABELS} from './EditorCanvas';
import {academic, containingAnswer, identifiers, questionOrder, nextQuestion, nextSubquestion} from './annotations';

const KINDS:Kind[]=['respuesta','subpregunta','calificacion','observacion','privacidad'];
const order=(a:Region,b:Region)=>(a.question_id||'').localeCompare(b.question_id||'', 'es', {numeric:true})||(a.reading_order??0)-(b.reading_order??0);
const shortId=(s:string)=>s.slice(0,8).toUpperCase();

function IdentifierSelect({label,value,values,onChange,prefix}:{label:string;value:string;values:string[];onChange:(value:string)=>void;prefix:'P'|''}){
 const [added,setAdded]=useState<string[]>([]);
 const options=identifiers(values,[...added,value]);
 return <label className="form-field"><span>{label}</span><select value={value} onChange={e=>{
  let next=e.target.value;
  if(next==='+'){
   let index=prefix?1:0;
   const name=(n:number)=>prefix?`P${n}`:String.fromCharCode(97+n%26)+(n>=26?Math.floor(n/26):'');
   while(options.includes(name(index)))index++;
   next=name(index);setAdded(prev=>[...prev,next]);
  }
  onChange(next);
 }}>
 {options.map(v=><option key={v}>{v}</option>)}<option value="+">+ Agregar {prefix?'pregunta':'inciso'}</option>
 </select></label>
}
function ScoreInput({label,value,onChange,inputRef,denominator=false}:{label:string;value:number|null;onChange:(n:number|null)=>void;inputRef?:React.RefObject<HTMLInputElement>;denominator?:boolean}){
 const [text,setText]=useState(value==null?'':String(value));
 const parsed=Number(text.replace(',','.'));
 const valid=/^\d+(?:[.,]\d+)?$/.test(text)&&Number.isFinite(parsed)&&(denominator?parsed>0:parsed>=0);
 return <label className="form-field"><span>{label} *</span><input ref={inputRef} aria-label={label} aria-required="true" inputMode="decimal" value={text} placeholder={denominator?'Ej. 10':'Ingresá el valor'}
  onChange={e=>{const next=e.target.value;setText(next);const n=Number(next.replace(',','.'));onChange(/^\d+(?:[.,]\d+)?$/.test(next)&&Number.isFinite(n)&&(denominator?n>0:n>=0)?n:null)}}/>
  {text&&!valid&&<small className="field-error">Ingresá un número {denominator?'mayor que cero':'mayor o igual a cero'}.</small>}
 </label>
}
function RegionProperties({r,onSave,onDelete,busy,questions,subquestions}:{r:Region;onSave:(r:RegionPayload)=>Promise<void>;onDelete:()=>Promise<void>;busy:boolean;questions:string[];subquestions:string[]}){
 const draft=serialize(r);
 const valueInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(r.kind==='calificacion'&&r.score_value==null&&!busy)valueInput.current?.focus()},[r.id,r.kind,r.scope,r.question_id,r.subquestion_id,busy]);
 const set=<K extends keyof RegionPayload>(name:K,value:RegionPayload[K])=>{
  const next={...draft,[name]:value};
  if(academic(next.kind)||next.kind==='calificacion'&&next.scope!=='examen')next.question_id ||= 'P1';
  if(next.kind==='subpregunta'||next.kind==='calificacion'&&next.scope==='inciso')next.subquestion_id ||= 'a';
  if(academic(next.kind))next.reading_order ||= 1;
  if(next.kind==='calificacion'){
   if(next.scope!=='pregunta'&&next.scope!=='inciso')next.scope='pregunta';
   next.question_id ||= 'P1';
   if(next.scope==='pregunta')next.subquestion_id=null;
  }else{next.score_value=null;next.score_denominator=null}
  void onSave(next);
 };
 const hasQuestion=academic(draft.kind)||draft.kind==='calificacion';
 return <fieldset disabled={busy} className="space-y-3">
  <div className="flex items-center justify-between"><div><div className="section-label">Autoguardado</div><h3 className="panel-heading">Región seleccionada</h3></div><span className="id-chip">{shortId(r.id)}</span></div>
  <label className="form-field"><span>Tipo de región</span><select value={draft.kind} onChange={e=>set('kind',e.target.value as Kind)}>
   {KINDS.map(k=><option key={k} value={k}>{LABELS[k].title}</option>)}
  </select></label>
  {draft.kind==='calificacion'&&<label className="form-field"><span>Alcance de la calificación</span><select value={draft.scope==='pregunta'||draft.scope==='inciso'?draft.scope:''} onChange={e=>set('scope',e.target.value as Scope)}>
   <option value="" disabled>Elegí el alcance</option><option value="pregunta">Pregunta</option><option value="inciso">Inciso</option>
  </select></label>}
  {hasQuestion&&<IdentifierSelect label="Pregunta" prefix="P" value={draft.question_id||'P1'} values={questions} onChange={v=>set('question_id',v)}/>}
  {(draft.kind==='subpregunta'||draft.kind==='calificacion'&&draft.scope==='inciso')&&<IdentifierSelect label="Inciso" prefix="" value={draft.subquestion_id||'a'} values={subquestions} onChange={v=>set('subquestion_id',v)}/>}
  {academic(draft.kind)&&<label className="form-field"><span>Orden de fragmentos de {draft.question_id}{draft.kind==='subpregunta'?'.'+draft.subquestion_id:''}</span><input type="number" min="1" value={draft.reading_order??1} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>0)set('reading_order',n)}}/></label>}
  {draft.kind==='calificacion'&&<div className="grade-fields" key={`${r.id}:${draft.scope}:${draft.question_id}:${draft.subquestion_id}`}>
   <ScoreInput label="Valor obtenido" value={draft.score_value} inputRef={valueInput} onChange={v=>set('score_value',v)}/>
   <ScoreInput label="Denominador" value={draft.score_denominator} denominator onChange={v=>set('score_denominator',v)}/>
   {gradeProblem(draft)&&<p className="field-error">{gradeProblem(draft)}. Completalo antes de exportar.</p>}
   {draft.value_text&&draft.score_value==null&&<p className="muted text-xs">Texto anterior: {draft.value_text}</p>}
  </div>}
  {draft.kind==='observacion'&&<label className="form-field"><span>Texto docente (opcional)</span><textarea rows={3} value={draft.note_text||''} onChange={e=>set('note_text',e.target.value)} placeholder="Transcripción manual"/></label>}
  {draft.kind==='privacidad'&&<div className="notice-privacy"><ShieldCheck size={16}/><span>Esta área se reemplazará por píxeles negros en toda imagen exportada.</span></div>}
  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500"><div className="coord-chip">x: {draft.x1} — {draft.x2}</div><div className="coord-chip">y: {draft.y1} — {draft.y2}</div></div>
  <button className="danger-ghost w-full" disabled={busy} onClick={()=>void onDelete()}><Trash2 size={15}/>Eliminar región</button>
 </fieldset>
}
function serialize(r:Region):RegionPayload{const {kind,x1,y1,x2,y2,question_id,subquestion_id,reading_order,scope,value_text,note_text,score_value,score_denominator}=r;return {kind,x1,y1,x2,y2,question_id,subquestion_id,reading_order,scope,value_text,note_text,score_value,score_denominator}}

export default function App(){
 const [batch,setBatch]=useState<Batch|null>(null),[batches,setBatches]=useState<BatchSummary[]>([]);
 const [pageIndex,setPageIndex]=useState(0),[tool,setTool]=useState<Kind|'seleccion'>('seleccion');
 const [selectedId,setSelectedId]=useState<string|null>(null),[zoom,setZoom]=useState(1);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [dpi,setDpi]=useState(200),[preview,setPreview]=useState(false),[reviewed,setReviewed]=useState(false);
 const [mode,setMode]=useState<'completo'|'ocr'>('completo'),[tab,setTab]=useState<'editor'|'export'>('editor');
 const [reviewedPages,setReviewedPages]=useState<Set<number>>(new Set());
 const [exportLink,setExportLink]=useState<string|null>(null);
 const [sidebar,setSidebar]=useState(true);
 const [gradeScope,setGradeScope]=useState<GradeScope>('pregunta');
 const [pending,setPending]=useState(0),[failed,setFailed]=useState<Record<string,RegionPayload>>({});
 const writes=useRef(Promise.resolve());
 const saving=pending>0;
 useEffect(()=>{
  if(!saving&&!Object.keys(failed).length)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[saving,failed]);
 const revision=useRef(0);
 useEffect(()=>{api.list().then(setBatches).catch(e=>setError(e.message))},[]);
 const page=batch?.pages[pageIndex];
 const selected=page?.regions.find(r=>r.id===selectedId)||null;
 const regionCount=batch?.pages.reduce((n,p)=>n+p.regions.filter(r=>r.kind!=='privacidad').length,0)||0;
 const pendingGrades=batch?.pages.flatMap(p=>p.regions.filter(r=>gradeProblem(r)).map(r=>({page:p.page_index,region:r})))||[];
 const privacyCount=batch?.pages.reduce((n,p)=>n+p.regions.filter(r=>r.kind==='privacidad').length,0)||0;
 const run=async (fn:()=>Promise<void>,success?:string)=>{setBusy(true);setError('');setMessage('');try{await fn();if(success)setMessage(success)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
 const navigate=(idx:number)=>{if(busy||saving||Object.keys(failed).length)return;setPageIndex(idx);setSelectedId(null);setZoom(1)};
 const changeBatch=(b:Batch)=>{setBatch(b);setPageIndex(0);setTool('seleccion');setSelectedId(null);setReviewed(false);setReviewedPages(new Set());setPreview(false);setTab('editor');setExportLink(null);setFailed({})};
 const reload=async()=>{if(batch)setBatch(await api.get(batch.id))};
 const upload=async(file:File)=>{await run(async()=>{const result=await api.upload(file,dpi);changeBatch(await api.get(result.id));setBatches(await api.list())},'PDF importado. Podés separar exámenes y comenzar a marcar regiones.')};
 const toggleBoundary=async(idx:number)=>{if(!batch||idx===0||saving||Object.keys(failed).length)return;
 await run(async()=>{const starts=batch.pages.filter(p=>p.is_exam_start).map(p=>p.page_index);
 const next=starts.includes(idx)?starts.filter(n=>n!==idx):[...starts,idx].sort((a,b)=>a-b);
 setBatch(await api.boundaries(batch.id,next));setExportLink(null);setReviewed(false);setReviewedPages(new Set())},'División de exámenes actualizada.')};
 const rotate=async(cw:boolean)=>{if(!batch||!page||saving||Object.keys(failed).length)return;
 await run(async()=>{const next=await api.rotate(batch.id,pageIndex,cw);setBatch(next);setExportLink(null);setSelectedId(null);setReviewed(false);setReviewedPages(new Set())},'Página rotada y anotaciones reubicadas.')};
 const persistRegion=async(id:string,payload:RegionPayload)=>{
  if(!batch)return;
  const batchId=batch.id;
  setBatch(prev=>prev&&prev.id===batchId?{...prev,pages:prev.pages.map(p=>({...p,regions:p.regions.map(r=>r.id===id?{...r,...payload}:r)}))}:prev);
  setReviewed(false);setReviewedPages(new Set());setExportLink(null);setPending(n=>n+1);
  revision.current++;
  const operation=writes.current.then(async()=>{
   try{await api.updateRegion(batchId,id,payload);setFailed(prev=>{const next={...prev};delete next[id];return next})}
   catch(e){setFailed(prev=>({...prev,[id]:payload}));setError(e instanceof Error?e.message:String(e))}
   finally{setPending(n=>n-1)}
  });
  writes.current=operation;
  await operation;
 };
 const saveRegion=async(payload:RegionPayload)=>{
  if(!batch||!page||!selected)return;
  if(academic(payload.kind)&&(payload.question_id!==selected.question_id||payload.kind!==selected.kind||payload.kind==='subpregunta'&&payload.subquestion_id!==selected.subquestion_id))
   payload={...payload,reading_order:questionOrder(batch,page,payload.question_id||'P1',selected.id,payload.kind,payload.subquestion_id)};
  if(payload.kind==='calificacion'&&(payload.scope==='pregunta'||payload.scope==='inciso')){
   setGradeScope(payload.scope);
   if(selected.kind!=='calificacion'||payload.scope!==selected.scope||payload.question_id!==selected.question_id||payload.subquestion_id!==selected.subquestion_id)
    payload={...payload,score_denominator:previousDenominator(batch,page,payload.scope,payload.question_id||'P1',payload.subquestion_id),score_value:selected.kind==='calificacion'?payload.score_value:null};
  }
  await persistRegion(selected.id,payload);
 };
 const deleteRegion=async()=>{if(!batch||!selected||saving||Object.keys(failed).length)return;
 await run(async()=>{await api.deleteRegion(batch.id,selected.id);revision.current++;setExportLink(null);setSelectedId(null);await reload();setReviewed(false);setReviewedPages(new Set())},'Región eliminada.')};
 const createRegion=async(box:{x1:number;y1:number;x2:number;y2:number})=>{if(!batch||!page||tool==='seleccion')return;
 if(busy||saving||Object.keys(failed).length)return;
 const parent=tool==='subpregunta'?containingAnswer(page,box):undefined;
 const question=tool==='respuesta'?nextQuestion(batch,page):parent?.question_id||selected?.question_id||'P1';
 const inciso=tool==='subpregunta'?nextSubquestion(batch,page,question):null;
 const target=nextGradeTarget(batch,page,gradeScope,selected);
 const payload:RegionPayload={...box,kind:tool,question_id:tool==='calificacion'?target.question:academic(tool)?question:null,
 subquestion_id:tool==='calificacion'?target.inciso:inciso,reading_order:academic(tool)?questionOrder(batch,page,question,undefined,tool,inciso):null,
 scope:tool==='calificacion'?gradeScope:null,value_text:null,note_text:null,score_value:null,score_denominator:tool==='calificacion'?previousDenominator(batch,page,gradeScope,target.question,target.inciso):null};
 await run(async()=>{const result=await api.createRegion(batch.id,pageIndex,payload);revision.current++;setExportLink(null);await reload();setSelectedId(result.id);setReviewed(false);setReviewedPages(new Set())},'Región guardada automáticamente.')};
 const moveRegion=async(id:string,box:{x1:number;y1:number;x2:number;y2:number})=>{if(!batch||!page)return;
 const region=page.regions.find(r=>r.id===id);if(!region)return;
 const clamp=(v:number,max:number)=>Math.max(0,Math.min(v,max));
 const payload={...serialize(region),x1:clamp(box.x1,page.width-1),y1:clamp(box.y1,page.height-1),x2:clamp(box.x2,page.width),y2:clamp(box.y2,page.height)};
 if(payload.x2<=payload.x1||payload.y2<=payload.y1)return;
 await persistRegion(id,payload)};
 const exportData=async()=>{if(!batch||!reviewed||pendingGrades.length||saving||Object.keys(failed).length||reviewedPages.size!==batch.pages_count)return;
 await run(async()=>{const res=await api.export(batch.id,mode);setExportLink(res.download_url);setMessage(`Exportación generada: ${res.exams_count} exámenes, ${res.regions_count} regiones y ${res.file_count} imágenes.`)})};
 const available=useMemo(()=>batches.slice(0,6),[batches]);
 return <div className="app">
  <header className="topbar">
   <div className="brand"><div className="brand-logo"><Layers3 size={19}/></div><div><strong>Exámenes<span className="brand-accent">Lab</span></strong><small>Preparación de datos académicos</small></div></div>
   <div className="topbar-center"><span className="status-dot"/>Aplicación local <span className="top-divider">/</span><span className="font-semibold text-slate-600">{batch?`Lote ${shortId(batch.id)}`:'Inicio'}</span></div>
   <div className="topbar-right"><span className="beta">MVP 0.1</span>{batch&&<button className="top-button" disabled={saving||busy||Object.keys(failed).length>0} onClick={()=>{setBatch(null);setSelectedId(null);setError('');setMessage('')}}><ArrowLeft size={15}/> Mis lotes</button>}</div>
  </header>
  {!batch?<main className="home">
   <section className="welcome"><div className="eyebrow"><span className="pill-line"/> INVESTIGACIÓN UNIVERSITARIA</div>
    <h1>De exámenes escaneados<br/>a datos <em>preparados para IA.</em></h1>
    <p>Una herramienta para separar, anotar y desidentificar exámenes manuscritos. Todo ocurre en tu equipo, sin ejecutar OCR ni subir documentos a terceros.</p>
   </section>
   <div className="home-grid"><div className="upload-card">
    <div className="upload-icon"><UploadCloud size={27}/></div><h2>Importar un nuevo lote</h2>
    <p>Arrastrá un PDF con varios exámenes o seleccioná un archivo desde tu equipo.</p>
    <label className="upload-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)upload(f)}}>
     <FilePlus2 size={25}/><span>Seleccionar archivo PDF</span><small>PDF de hasta 100 MB · Máximo 250 páginas</small>
     <input type="file" accept="application/pdf,.pdf" hidden disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value=''}}/>
    </label>
    <div className="upload-bottom"><label>Resolución de renderizado</label><select value={dpi} onChange={e=>setDpi(Number(e.target.value))}><option value={150}>150 DPI · rápido</option><option value={200}>200 DPI · equilibrado</option><option value={300}>300 DPI · máximo detalle</option></select></div>
   </div>
   <div className="recent-card"><div className="card-header"><div><div className="section-label">CONTINUIDAD DE TRABAJO</div><h2>Lotes recientes</h2></div><Archive size={21} color="#8a94a4"/></div>
    {available.length?available.map(b=><button key={b.id} className="recent-row" onClick={()=>run(async()=>changeBatch(await api.get(b.id)))}>
      <div className="recent-icon"><FileText size={20}/></div><div className="flex-1 text-left"><strong>Lote {shortId(b.id)}</strong><small>{b.pages_count} páginas · {b.dpi} DPI</small></div><ChevronRight size={17}/>
    </button>):<div className="recent-empty"><Layers3 size={30}/><strong>Todavía no hay lotes</strong><span>Los documentos que importes aparecerán acá para continuar con su anotación.</span></div>}
   </div></div>
   <div className="home-foot"><span><ShieldCheck size={16}/> Originales preservados</span><span><Scissors size={16}/> Anotación por regiones</span><span><FileDown size={16}/> Listo para OCR</span></div>
  </main>:<div className={`workspace ${sidebar?'':'sidebar-hidden'}`}>
   <aside className="leftbar" aria-label="Documento activo">
    <div className="sidebar-top"><div className="section-label">DOCUMENTO ACTIVO</div><h2>Lote {shortId(batch.id)}</h2><div className="stats-line"><span><FileText size={13}/>{batch.pages_count} páginas</span><span><Layers3 size={13}/>{batch.exams_count} exámenes</span></div></div>
    <div className="sidebar-section-title"><span>PÁGINAS Y EXÁMENES</span><span className="text-[10px]">{batch.pages_count}</span></div>
    <div className="page-list">{batch.pages.map((p,i)=><div key={p.id}>
      {i>0&&<button className={`separator ${p.is_exam_start?'active':''}`} onClick={()=>toggleBoundary(i)} disabled={busy||saving||Object.keys(failed).length>0} title="Agregar o quitar divisor de exámenes"><span className="separator-line"/><span>{p.is_exam_start?'+ Inicio de examen':'＋ Separar aquí'}</span><span className="separator-line"/></button>}
      <button className={`page-tile ${i===pageIndex?'selected':''}`} onClick={()=>navigate(i)}>
       <div className="thumb"><img loading="lazy" src={api.image(batch.id,i,true,false)+`&v=${p.rotation}`} alt={`Página ${i+1}`}/></div>
       <div className="page-copy"><b>Página {i+1}</b><span>{p.exam_id} · Hoja {p.exam_page_index}</span><small>{p.regions.length} regiones {p.rotation?`· ${p.rotation}°`:''}</small></div>
       {i===pageIndex&&<span className="selected-marker"/>}
      </button>
    </div>)}</div>
    <div className="sidebar-footer"><Info size={15}/><span>Usá las líneas divisorias para indicar dónde comienza cada examen.</span></div>
   </aside>
   <main className="main-stage">
    <div className="canvas-host">{page&&<EditorCanvas key={page.id} page={page} url={api.image(batch.id,pageIndex,false,preview)+`&v=${page.rotation}&revision=${preview?revision.current:0}`} tool={tool} zoom={zoom} selected={selectedId} readOnly={preview||busy} preview={preview} select={id=>{setSelectedId(id);setTool('seleccion')}} create={createRegion} move={moveRegion}/>}</div>
    <div className="stage-foot"><span><Info size={14}/> {saving?'Guardando cambios…':Object.keys(failed).length?'Hay cambios sin guardar':preview?'Vista anonimizada · solo lectura':'Todos los cambios guardados'}</span><span>{page?.width} × {page?.height} px · {batch.dpi} DPI</span></div>
   </main>
   <aside className="rightbar">
     <div className="right-tabs"><button className={tab==='editor'?'current':''} onClick={()=>setTab('editor')}>Regiones</button><button className={tab==='export'?'current':''} onClick={()=>setTab('export')}>Exportar</button></div>
    <div className="editor-toolbar"><button className="icon-button" title={sidebar?'Ocultar documento activo':'Mostrar documento activo'} aria-expanded={sidebar} onClick={()=>setSidebar(v=>!v)}>{sidebar?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}</button><div className="flex items-center gap-2"><button className="icon-button" onClick={()=>navigate(Math.max(pageIndex-1,0))} disabled={pageIndex===0}><ChevronLeft size={18}/></button><span className="page-counter">Página <b>{pageIndex+1}</b> de {batch.pages_count}</span><button className="icon-button" onClick={()=>navigate(Math.min(pageIndex+1,batch.pages_count-1))} disabled={pageIndex===batch.pages_count-1}><ChevronRight size={18}/></button></div>
     <div className="toolbar-sep"/><div className="flex items-center gap-2"><button className="icon-button" title="Rotar a la izquierda" onClick={()=>rotate(false)} disabled={busy}><RotateCcw size={17}/></button><button className="icon-button" title="Rotar a la derecha" onClick={()=>rotate(true)} disabled={busy}><RotateCw size={17}/></button><span className="toolbar-hint">Rotar hoja</span></div>
     <div className="toolbar-grow"/>
     <button className="icon-button" onClick={()=>setZoom(v=>Math.max(0.4,+(v-.2).toFixed(2)))} title="Alejar"><ZoomOut size={17}/></button><span className="zoom-label">{Math.round(zoom*100)}%</span><button className="icon-button" onClick={()=>setZoom(v=>Math.min(3,+(v+.2).toFixed(2)))} title="Acercar"><ZoomIn size={17}/></button>
    </div>
    <div className="tools-line" aria-label="Herramientas de anotación"><button aria-pressed={tool==='seleccion'} onClick={()=>setTool('seleccion')} className={`tool ${tool==='seleccion'?'active':''}`}><MousePointer2 size={15}/> Seleccionar</button><span className="tools-divider"/>
     {KINDS.map(k=><button key={k} aria-pressed={tool===k} className={`tool ${tool===k?'active':''}`} style={{'--tag-color':LABELS[k].color} as React.CSSProperties} onClick={()=>{setTool(k);setPreview(false)}}><span className="color-dot"/>{LABELS[k].title}</button>)}
    </div>
     {tab==='editor'?<div className="right-body">
       {selected?<RegionProperties key={selected.id} questions={identifiers(['P1','P2','P3'],batch.pages.flatMap(p=>p.regions.map(r=>r.question_id)))} subquestions={identifiers(['a','b','c'],batch.pages.flatMap(p=>p.regions.filter(r=>r.question_id===selected.question_id).map(r=>r.subquestion_id)))} r={selected} onSave={saveRegion} onDelete={deleteRegion} busy={busy}/>:<div className="panel-placeholder"><div className="panel-icon"><MousePointer2 size={20}/></div><h3>Seleccioná una región</h3><p>Usá las herramientas para dibujar un rectángulo. Luego podrás asignarle pregunta, inciso, orden o calificación.</p></div>}
       <div className="border-t border-slate-200 pt-5 mt-6"><div className="flex justify-between items-center mb-3"><h3 className="panel-heading">Regiones de la página</h3><span className="id-chip">{page?.regions.length||0}</span></div>
        {page?.regions.length? [...page.regions].sort(order).map(r=><button key={r.id} onClick={()=>{setSelectedId(r.id);setTool('seleccion')}} className={`region-row ${selectedId===r.id?'chosen':''}`}><span className="region-color" style={{background:LABELS[r.kind].color}}/><div><strong>{LABELS[r.kind].title}</strong><small>{r.question_id||'Sin pregunta'}{r.subquestion_id?'.'+r.subquestion_id:''}{r.reading_order?` · Orden ${r.reading_order}`:''}{r.kind==='calificacion'?` · ${r.score_value??'…'} / ${r.score_denominator??'…'}`:''}</small></div><ChevronRight size={15}/></button>):<p className="muted text-sm">No se registraron regiones en esta página.</p>}
       </div>
     </div>:<div className="right-body space-y-5">
       <div><div className="section-label">PASO FINAL</div><h3 className="panel-heading mt-2">Preparar paquete para OCR</h3><p className="text-sm muted mt-2">Todas las máscaras de privacidad se aplican antes de generar los recortes.</p></div>
       <div className="metrics-grid"><div><b>{batch.exams_count}</b><span>Exámenes</span></div><div><b>{regionCount}</b><span>Recortes</span></div><div><b>{privacyCount}</b><span>Máscaras</span></div></div>
       <button className="secondary w-full" onClick={()=>setPreview(v=>!v)}>{preview?<EyeOff size={16}/>:<Eye size={16}/>} {preview?'Ocultar previsualización':'Previsualizar privacidad'}</button>
       <div className="per-page-review"><div className="flex items-center justify-between"><strong>Revisión por página</strong><span>{reviewedPages.size} / {batch.pages_count}</span></div><p>Seleccioná cada página, previsualizá sus máscaras y marcala como revisada.</p><label className="review-check"><input type="checkbox" checked={reviewedPages.has(pageIndex)} onChange={e=>{setReviewedPages(prev=>{const next=new Set(prev);if(e.target.checked)next.add(pageIndex);else next.delete(pageIndex);return next})}}/><span>Página {pageIndex+1} revisada</span></label><div className="flex gap-2"><button className="secondary flex-1" onClick={()=>navigate(Math.max(0,pageIndex-1))} disabled={pageIndex===0}><ChevronLeft size={15}/> Anterior</button><button className="secondary flex-1" onClick={()=>navigate(Math.min(batch.pages_count-1,pageIndex+1))} disabled={pageIndex===batch.pages_count-1}>Siguiente <ChevronRight size={15}/></button></div></div>
       <label className="form-field"><span>Formato de salida</span><select value={mode} onChange={e=>setMode(e.target.value as 'completo'|'ocr')}><option value="completo">Completo: páginas + recortes</option><option value="ocr">Solo recortes para OCR</option></select></label>
       <label className="review-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>Revisé todas las páginas y confirmé que los datos sensibles están cubiertos. Entiendo que el sistema no detecta información privada automáticamente.</span></label>
       {pendingGrades.length>0&&<div className="grade-pending" role="alert"><strong>{pendingGrades.length} calificaciones pendientes</strong><p>Asigná pregunta/inciso y completá valor y denominador.</p>{pendingGrades.map(({page:index,region:r})=><button key={r.id} disabled={busy||saving||Object.keys(failed).length>0} onClick={()=>{navigate(index);setSelectedId(r.id);setTool('seleccion');setTab('editor');setPreview(false)}}>Página {index+1} · {r.question_id||'Sin pregunta'}{r.scope==='inciso'?'.'+r.subquestion_id:''}</button>)}</div>}
       <button className="primary w-full" onClick={exportData} disabled={busy||saving||pendingGrades.length>0||Object.keys(failed).length>0||!reviewed||reviewedPages.size!==batch.pages_count||regionCount===0}><FileDown size={17}/> Generar exportación</button>
       {exportLink&&<a className="download-link" href={exportLink} download><Download size={17}/> Descargar ZIP preparado</a>}
       <div className="notice-privacy"><ShieldCheck size={17}/><span>El paquete no incluye PDF original, nombres de archivo de origen ni imágenes sin ocultar.</span></div>
      </div>}
    <div className="right-bottom"><div className="small-brand"><ShieldCheck size={15}/> Procesamiento local · Sin OCR</div></div>
   </aside>
  </div>}
  {Object.keys(failed).length>0&&<div className="save-failure" role="alert">Hay cambios sin guardar. <button disabled={saving} onClick={()=>{for(const [id,payload] of Object.entries(failed))void persistRegion(id,payload)}}>Reintentar guardado</button></div>}
  {(error||message||busy)&&<div className={`toast ${error?'toast-error':''}`}>
   {busy?<LoaderCircle className="animate-spin" size={17}/>:error?<X size={17}/>:<CheckCircle2 size={17}/>}
   <span>{busy?'Procesando, por favor no cierres esta pestaña…':error||message}</span>
   {!busy&&<button onClick={()=>{setError('');setMessage('')}}><X size={16}/></button>}
  </div>}
 </div>;
}
