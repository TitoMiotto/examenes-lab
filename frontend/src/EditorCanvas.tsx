import {useEffect,useMemo,useRef,useState} from 'react';
import {Stage,Layer,Rect,Image as KImage,Transformer,Text as KText} from 'react-konva';
import type Konva from 'konva';
import type {Region, Kind, Page} from './api';
import {regionStack} from './annotations';

export const LABELS:Record<Kind,{title:string,color:string}> = {
 respuesta:{title:'Respuesta',color:'#3b82f6'},
 subpregunta:{title:'Subpregunta',color:'#8b5cf6'},
 calificacion:{title:'Calificación docente',color:'#e97841'},
 observacion:{title:'Observación docente',color:'#dbac31'},
 privacidad:{title:'Privacidad',color:'#e4455d'},
};

type Props={page:Page; url:string;tool:Kind|'seleccion';zoom:number;selected:string|null;
 select:(id:string|null)=>void; create:(box:{x1:number;y1:number;x2:number;y2:number})=>void;
 readOnly?:boolean;preview?:boolean;
 move:(id:string,box:{x1:number;y1:number;x2:number;y2:number})=>void;};

function Rectangle({region, selected, editing, pageWidth, pageHeight, choose, update}:{region:Region;selected:boolean;editing:boolean;pageWidth:number;pageHeight:number;choose:()=>void;update:(box:{x1:number;y1:number;x2:number;y2:number})=>void}){
 const shape=useRef<Konva.Rect>(null),transformer=useRef<Konva.Transformer>(null),label=useRef<Konva.Text>(null);
 useEffect(()=>{if(selected&&shape.current&&transformer.current){transformer.current.nodes([shape.current]);transformer.current.getLayer()?.batchDraw()}},[selected]);
 const color=LABELS[region.kind].color;
 const clip=(x:number,y:number,w:number,h:number)=>{
  const x1=Math.max(0,Math.min(Math.round(x),pageWidth-3));
  const y1=Math.max(0,Math.min(Math.round(y),pageHeight-3));
  update({x1,y1,x2:Math.min(pageWidth,Math.round(x1+Math.max(3,w))),y2:Math.min(pageHeight,Math.round(y1+Math.max(3,h)))});
 };
 return <>
  <Rect ref={shape} x={region.x1} y={region.y1} width={region.x2-region.x1} height={region.y2-region.y1}
   fill={`${color}24`} stroke={color} strokeWidth={selected?3:2} dash={region.kind==='privacidad'?[8,5]:undefined}
   name="region" listening={!editing} draggable={!editing} onMouseDown={e=>{e.cancelBubble=true;choose()}} onTouchStart={e=>{e.cancelBubble=true;choose()}} onTap={choose} onDragStart={e=>{e.cancelBubble=true;choose()}}
   onDragMove={e=>{const n=e.target;n.position({x:Math.max(0,Math.min(n.x(),pageWidth-(region.x2-region.x1))),y:Math.max(0,Math.min(n.y(),pageHeight-(region.y2-region.y1)))});label.current?.position({x:n.x()+4,y:n.y()+3})}}
   onDragEnd={e=>{const node=e.target;clip(node.x(),node.y(),region.x2-region.x1,region.y2-region.y1)}}
   onTransformEnd={()=>{const n=shape.current;if(!n)return;const w=n.width()*n.scaleX(),h=n.height()*n.scaleY();n.scaleX(1);n.scaleY(1);clip(n.x(),n.y(),w,h)}}
  />
  <KText ref={label} x={region.x1+4} y={region.y1+3} text={region.kind==='privacidad'?'PRIV':`${region.question_id||LABELS[region.kind].title}${region.kind==='subpregunta'?'.'+region.subquestion_id:''}${region.reading_order?' · '+region.reading_order:''}`}
   fontSize={16} fontStyle="bold" fill={color} listening={false}/>
  {selected&&<Transformer ref={transformer} shouldOverdrawWholeArea={true} rotateEnabled={false} flipEnabled={false} borderStroke={color}
   anchorFill="white" anchorStroke={color} anchorSize={9}
   boundBoxFunc={(a,b)=>Math.abs(b.width)<8||Math.abs(b.height)<8?a:b}/>}
 </>;
}

export default function EditorCanvas({page,url,tool,zoom,selected,select,create,move,readOnly=false,preview=false}:Props){
 const [img,setImg]=useState<HTMLImageElement|null>(null),[size,setSize]=useState({width:900,height:700});
 const parent=useRef<HTMLDivElement>(null),stage=useRef<Konva.Stage>(null);
 const drawing=useRef<{x:number;y:number}|null>(null);
 const [draft,setDraft]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
 useEffect(()=>{setImg(null);const image=new window.Image();image.onload=()=>setImg(image);image.src=url;return ()=>{image.onload=null}},[url]);
 useEffect(()=>{const elem=parent.current;if(!elem)return;const obs=new ResizeObserver(()=>setSize({width:elem.clientWidth,height:elem.clientHeight}));obs.observe(elem);return()=>obs.disconnect()},[]);
 const scale=useMemo(()=>Math.min(Math.max(1,size.width-12)/page.width,Math.max(1,size.height-12)/page.height)*zoom,[size,page.width,page.height,zoom]);
 const pointer=()=>{const s=stage.current,p=s?.getPointerPosition();if(!p)return null;return {x:Math.max(0,Math.min(page.width,Math.round(p.x/scale))),y:Math.max(0,Math.min(page.height,Math.round(p.y/scale)))}};
 const start=(e:Konva.KonvaEventObject<MouseEvent|TouchEvent>)=>{
   if(readOnly)return;
   if(tool==='seleccion'){if(e.target===e.target.getStage()||e.target.name()==='background')select(null);return}
   if(e.target!==e.target.getStage()&&e.target.name()!=='background')return;
   const p=pointer();if(!p)return;drawing.current=p;setDraft({x1:p.x,y1:p.y,x2:p.x,y2:p.y});
 };
 const progress=()=>{if(!drawing.current)return;const p=pointer();if(!p)return;setDraft({x1:Math.min(drawing.current.x,p.x),y1:Math.min(drawing.current.y,p.y),x2:Math.max(drawing.current.x,p.x),y2:Math.max(drawing.current.y,p.y)})};
 const finish=()=>{if(!drawing.current)return;const p=pointer();const a=drawing.current;drawing.current=null;setDraft(null);if(!p)return;
 const box={x1:Math.min(a.x,p.x),y1:Math.min(a.y,p.y),x2:Math.max(a.x,p.x),y2:Math.max(a.y,p.y)};
 if(!readOnly&&box.x2-box.x1>=12&&box.y2-box.y1>=12)create(box);
 };
 return <div ref={parent} className={`canvas-scroller ${readOnly?'read-only':tool==='seleccion'?'selection-mode':'drawing-mode'}`}>
  <div className="canvas-inner">{!img&&<span className="image-loading" role="status">Cargando imagen…</span>}<Stage ref={stage} width={page.width*scale} height={page.height*scale}
     onMouseDown={start} onTouchStart={start} onMouseMove={progress} onTouchMove={progress} onMouseUp={finish} onTouchEnd={finish}>
    <Layer scaleX={scale} scaleY={scale}>
      {img&&<KImage name="background" image={img} width={page.width} height={page.height}/>}
      {!preview&&[...page.regions].sort((a,b)=>regionStack(a,b,selected)).map(r=><Rectangle key={r.id} region={r} editing={readOnly||tool!=='seleccion'} pageWidth={page.width} pageHeight={page.height} selected={!readOnly&&selected===r.id&&tool==='seleccion'}
       choose={()=>select(r.id)} update={b=>move(r.id,b)}/>) }
      {draft&&<Rect x={draft.x1} y={draft.y1} width={draft.x2-draft.x1} height={draft.y2-draft.y1}
       stroke={LABELS[tool==='seleccion'?'respuesta':tool].color} strokeWidth={3} dash={[6,4]} fill="rgba(14,165,233,0.13)" listening={false}/>}
    </Layer>
   </Stage></div>
 </div>
}
