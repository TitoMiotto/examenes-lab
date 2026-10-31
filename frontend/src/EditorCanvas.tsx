import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Stage,Layer,Rect,Image as KImage,Transformer,Text as KText} from 'react-konva';
import type Konva from 'konva';
import type {Region, Kind, Page} from './api';
import {clampBox,regionStack,type Box} from './annotations';

export const LABELS:Record<Kind,{title:string,color:string}> = {
 respuesta:{title:'Respuesta',color:'#3b82f6'},
 subpregunta:{title:'Subpregunta',color:'#8b5cf6'},
 calificacion:{title:'Calificación docente',color:'#e97841'},
 observacion:{title:'Observación docente',color:'#dbac31'},
 privacidad:{title:'Privacidad',color:'#e4455d'},
};

const GUTTER=16;
type Props={page:Page;url:string;tool:Kind|'seleccion';zoom:number;selected:string|null;
 select:(id:string|null)=>void;create:(box:Box)=>void;move:(id:string,box:Box)=>void;
 readOnly?:boolean;preview?:boolean};

function Rectangle({region,selected,editable,page,choose,update}:{region:Region;selected:boolean;editable:boolean;page:Page;choose:()=>void;update:(box:Box)=>void}) {
 const shape=useRef<Konva.Rect>(null),label=useRef<Konva.Text>(null);
 const color=LABELS[region.kind].color;
 const follow=()=>{const n=shape.current;if(n)label.current?.position({x:n.x()+4,y:n.y()+3})};
 const commit=()=>{
  const n=shape.current;if(!n)return;
  const box=clampBox({x1:n.x(),y1:n.y(),x2:n.x()+n.width()*n.scaleX(),y2:n.y()+n.height()*n.scaleY()},page.width,page.height);
  n.setAttrs({x:box.x1,y:box.y1,width:box.x2-box.x1,height:box.y2-box.y1,scaleX:1,scaleY:1});
  follow();update(box);
 };
 return <>
  <Rect ref={shape} id={region.id} name="region" x={region.x1} y={region.y1} width={region.x2-region.x1} height={region.y2-region.y1}
   fill={`${color}24`} stroke={color} strokeWidth={selected?2:1} strokeScaleEnabled={false} hitStrokeWidth={0}
   dash={region.kind==='privacidad'?[8,5]:undefined} listening={editable} draggable={editable}
   onPointerDown={e=>{e.cancelBubble=true;choose()}}
   onDragStart={e=>{e.cancelBubble=true;choose()}}
   onDragMove={()=>{const n=shape.current;if(!n)return;n.position({x:Math.max(0,Math.min(n.x(),page.width-n.width())),y:Math.max(0,Math.min(n.y(),page.height-n.height()))});follow()}}
   onDragEnd={commit} onTransform={follow} onTransformEnd={commit}
   onMouseEnter={e=>{e.target.getStage()!.container().style.cursor='move'}}
   onMouseLeave={e=>{e.target.getStage()!.container().style.cursor='default'}}/>
  <KText ref={label} x={region.x1+4} y={region.y1+3}
   text={region.kind==='privacidad'?'PRIV':`${region.question_id||LABELS[region.kind].title}${region.kind==='subpregunta'?'.'+region.subquestion_id:''}${region.reading_order?' · '+region.reading_order:''}`}
   fontSize={16} fontStyle="bold" fill={color} listening={false}/>
 </>;
}

export default function EditorCanvas({page,url,tool,zoom,selected,select,create,move,readOnly=false,preview=false}:Props) {
 const [img,setImg]=useState<HTMLImageElement|null>(null),[width,setWidth]=useState(900),[imageError,setImageError]=useState(false);
 const parent=useRef<HTMLDivElement>(null),stage=useRef<Konva.Stage>(null),layer=useRef<Konva.Layer>(null),transformer=useRef<Konva.Transformer>(null);
 const drawing=useRef<{x:number;y:number}|null>(null);
 const [draft,setDraft]=useState<Box|null>(null);
 const editable=!readOnly&&tool==='seleccion';
 const scale=Math.max(1,width-2*GUTTER)/page.width*zoom;
 useEffect(()=>{
  setImg(null);setImageError(false);
  const image=new window.Image();image.onload=()=>setImg(image);image.onerror=()=>setImageError(true);image.src=url;
  return()=>{image.onload=null;image.onerror=null};
 },[url]);
 useEffect(()=>{
  const elem=parent.current;if(!elem)return;
  const observer=new ResizeObserver(()=>setWidth(elem.clientWidth));observer.observe(elem);
  return()=>observer.disconnect();
 },[]);
 // A single transformer is painted above every region. Only its handles receive
 // events; an invisible filled transformer must never steal a neighboring region's click.
 useLayoutEffect(()=>{
  const tr=transformer.current;if(!tr)return;
  const node=editable&&selected?stage.current?.findOne<Konva.Rect>(`#${selected}`):null;
  tr.nodes(node?[node]:[]);tr.getLayer()?.batchDraw();
 },[selected,editable,page.regions]);
 const pointer=()=>{
  const p=layer.current?.getRelativePointerPosition();if(!p)return null;
  return {x:Math.max(0,Math.min(page.width,Math.round(p.x))),y:Math.max(0,Math.min(page.height,Math.round(p.y)))};
 };
 const start=(e:Konva.KonvaEventObject<PointerEvent>)=>{
  if(readOnly||!img||e.evt.button>0)return;
  if(e.target!==stage.current&&e.target.name()!=='background')return;
  if(tool==='seleccion'){select(null);return}
  const p=pointer();if(!p)return;
  stage.current?.setPointersPositions(e.evt);
  // Keep drawing through a pointer release outside the image/stage.
  stage.current?.setPointerCapture(e.evt.pointerId);
  drawing.current=p;setDraft({x1:p.x,y1:p.y,x2:p.x,y2:p.y});
 };
 const progress=()=>{
  if(!drawing.current)return;const p=pointer();if(!p)return;
  setDraft({x1:Math.min(drawing.current.x,p.x),y1:Math.min(drawing.current.y,p.y),x2:Math.max(drawing.current.x,p.x),y2:Math.max(drawing.current.y,p.y)});
 };
 const finish=(e:Konva.KonvaEventObject<PointerEvent>)=>{
  if(!drawing.current)return;
  const a=drawing.current,p=pointer();drawing.current=null;setDraft(null);
  stage.current?.releaseCapture(e.evt.pointerId);
  if(!p||readOnly)return;
  const box={x1:Math.min(a.x,p.x),y1:Math.min(a.y,p.y),x2:Math.max(a.x,p.x),y2:Math.max(a.y,p.y)};
  if(box.x2-box.x1>=12&&box.y2-box.y1>=12)create(box);
 };
 return <div ref={parent} className={`canvas-scroller ${readOnly?'read-only':tool==='seleccion'?'selection-mode':'drawing-mode'}`}>
  <div className="canvas-inner">
   {!img&&<span className="image-loading" role={imageError?'alert':'status'}>{imageError?'No se pudo cargar la imagen. Volvé a abrir la página.':'Cargando imagen…'}</span>}
   <Stage ref={stage} width={page.width*scale+2*GUTTER} height={page.height*scale+2*GUTTER}
    onPointerDown={start} onPointerMove={progress} onPointerUp={finish}
    onPointerCancel={()=>{drawing.current=null;setDraft(null)}}>
    <Layer ref={layer} x={GUTTER} y={GUTTER} scaleX={scale} scaleY={scale}>
     {img&&<KImage name="background" image={img} width={page.width} height={page.height}/>}
     {!preview&&[...page.regions].sort(regionStack).map(r=><Rectangle key={r.id} region={r} selected={r.id===selected} editable={editable} page={page} choose={()=>select(r.id)} update={box=>move(r.id,box)}/>)}
     {draft&&<Rect x={draft.x1} y={draft.y1} width={draft.x2-draft.x1} height={draft.y2-draft.y1} stroke={LABELS[tool==='seleccion'?'respuesta':tool].color} strokeWidth={2/scale} dash={[6/scale,4/scale]} fill="rgba(14,165,233,.13)" listening={false}/>}
     <Transformer ref={transformer} visible={editable} shouldOverdrawWholeArea={false}
      rotateEnabled={false} flipEnabled={false} keepRatio={false} ignoreStroke={true}
      anchorSize={10} anchorStrokeWidth={1} anchorCornerRadius={2} borderStroke="#246d9c" anchorStroke="#246d9c" anchorFill="white"
      anchorDragBoundFunc={(_old:{x:number;y:number},pos:{x:number;y:number})=>({x:Math.max(GUTTER,Math.min(GUTTER+page.width*scale,pos.x)),y:Math.max(GUTTER,Math.min(GUTTER+page.height*scale,pos.y))})}
      boundBoxFunc={(old,next)=>next.width<3*scale||next.height<3*scale?old:next}/>
    </Layer>
   </Stage>
  </div>
 </div>;
}
