"""API local para anotación y desidentificación de exámenes."""
import hashlib
import shutil
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, model_validator
from PIL import Image

from .db import DATA_DIR, connect, init_db
from .services import batch_dir, export_zip, oriented_image, png_bytes, redact, render_pdf, rotate_rectangle

MAX_UPLOAD = 100 * 1024 * 1024
KINDS = ('respuesta','subpregunta','calificacion','observacion','privacidad')

def now():
    return datetime.now(timezone.utc).isoformat()

def uid():
    return uuid.uuid4().hex

def asdict(row):
    return dict(row) if row else None

@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    yield

app = FastAPI(title='Exámenes Lab — API', version='0.1.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_methods=['GET','POST','PATCH','DELETE','PUT'], allow_headers=['*'])

class BoundaryUpdate(BaseModel):
    starts: list[int]

class RegionInput(BaseModel):
    kind: Literal['respuesta','subpregunta','calificacion','observacion','privacidad']
    x1: int = Field(ge=0)
    y1: int = Field(ge=0)
    x2: int = Field(gt=0)
    y2: int = Field(gt=0)
    question_id: str | None = Field(default=None, max_length=32)
    subquestion_id: str | None = Field(default=None, max_length=32)
    reading_order: int | None = Field(default=None, ge=1)
    scope: Literal['examen','pregunta','inciso'] | None = None
    value_text: str | None = Field(default=None, max_length=150)
    note_text: str | None = Field(default=None, max_length=2000)

    @model_validator(mode='after')
    def validate_rules(self):
        if self.x1 >= self.x2 or self.y1 >= self.y2:
            raise ValueError('El rectángulo debe tener área positiva')
        self.question_id = self.question_id.strip() if self.question_id else None
        self.subquestion_id = self.subquestion_id.strip() if self.subquestion_id else None
        if self.kind in ('respuesta','subpregunta'):
            if not self.question_id or self.reading_order is None:
                raise ValueError('Respuesta y subpregunta requieren pregunta y orden')
            if self.kind == 'subpregunta' and not self.subquestion_id:
                raise ValueError('Subpregunta requiere identificador de inciso')
        if self.kind == 'calificacion':
            if not self.scope:
                raise ValueError('La calificación requiere alcance')
            if self.scope in ('pregunta','inciso') and not self.question_id:
                raise ValueError('El alcance requiere pregunta')
            if self.scope == 'inciso' and not self.subquestion_id:
                raise ValueError('El alcance inciso requiere inciso')
        return self

class ExportInput(BaseModel):
    mode: Literal['completo','ocr'] = 'completo'
    privacy_reviewed: bool = False


def checked_batch(c, batch_id):
    r = c.execute('SELECT * FROM batches WHERE id=?',(batch_id,)).fetchone()
    if not r:
        raise HTTPException(404,'Lote inexistente')
    return dict(r)

def checked_page(c, batch_id, page_idx):
    p = c.execute('SELECT * FROM pages WHERE batch_id=? AND page_index=?',(batch_id,page_idx)).fetchone()
    if not p:
        raise HTTPException(404,'Página inexistente')
    return dict(p)

def serialized_batch(c, batch_id):
    b = checked_batch(c,batch_id)
    # original_filename es información privada; nunca forma parte de los derivados.
    b.pop('original_filename',None)
    b.pop('source_sha256',None)
    pages = [dict(x) for x in c.execute('SELECT * FROM pages WHERE batch_id=? ORDER BY page_index',(batch_id,))]
    all_regions = [dict(x) for x in c.execute('SELECT r.* FROM regions r JOIN pages p ON p.id=r.page_id WHERE p.batch_id=? ORDER BY p.page_index,r.rowid',(batch_id,))]
    by_page = {}
    for r in all_regions:
        by_page.setdefault(r['page_id'],[]).append(r)
    exam = 0
    exam_index = 0
    for p in pages:
        if p['is_exam_start']:
            exam += 1
            exam_index = 0
        exam_index += 1
        p['exam_id'] = f'EX_{exam:04d}'
        p['exam_page_index'] = exam_index
        p['regions'] = by_page.get(p['id'],[])
    b['pages'] = pages
    b['exams_count'] = exam
    return b

@app.get('/api/health')
def health():
    return {'status':'ok'}

@app.get('/api/batches')
def list_batches():
    with connect() as c:
        return [dict(r) for r in c.execute('SELECT id,pages_count,dpi,created_at FROM batches ORDER BY created_at DESC')]

@app.post('/api/batches',status_code=201)
async def upload_pdf(file: UploadFile=File(...), dpi:int=200):
    if not 100 <= dpi <= 300:
        raise HTTPException(422,'Resolución válida: 100 a 300 DPI')
    batch_id=uid()
    work=batch_dir(batch_id)
    work.mkdir(parents=True,exist_ok=False)
    pdf=work / 'original.pdf'
    content_bytes=0
    sha=hashlib.sha256()
    try:
        with pdf.open('wb') as f:
            while chunk:=await file.read(1024*1024):
                content_bytes+=len(chunk)
                if content_bytes > MAX_UPLOAD:
                    raise HTTPException(413,'El archivo excede 100 MB')
                sha.update(chunk)
                f.write(chunk)
        with pdf.open('rb') as check_file:
            valid_pdf = check_file.read(5) == b'%PDF-'
        if not content_bytes or not valid_pdf:
            raise HTTPException(422,'Archivo inválido: se necesita un PDF')
        try:
            rendered=render_pdf(pdf,work,dpi)
        except Exception as e:
            raise HTTPException(422,f'No se pudo convertir el PDF: {e}') from e
        with connect() as c:
            c.execute('INSERT INTO batches VALUES (?,?,?,?,?,?)',(batch_id,Path(file.filename or 'archivo.pdf').name,sha.hexdigest(),len(rendered),dpi,now()))
            for p in rendered:
                c.execute('INSERT INTO pages (id,batch_id,page_index,width,height,rotation,is_exam_start) VALUES(?,?,?,?,?,?,?)',
                    (uid(),batch_id,p['page_index'],p['width'],p['height'],0,1 if p['page_index']==0 else 0))
        return {'id':batch_id,'pages_count':len(rendered),'dpi':dpi}
    except Exception:
        shutil.rmtree(work,ignore_errors=True)
        raise

@app.get('/api/batches/{batch_id}')
def get_batch(batch_id:str):
    with connect() as c:
        return serialized_batch(c,batch_id)

@app.put('/api/batches/{batch_id}/boundaries')
def set_boundaries(batch_id:str, payload:BoundaryUpdate):
    with connect() as c:
        b=checked_batch(c,batch_id)
        starts=payload.starts
        if sorted(set(starts)) != starts or not starts or starts[0]!=0 or any(s<0 or s>=b['pages_count'] for s in starts):
            raise HTTPException(422,'Incluí la página 0 y límites únicos, ordenados y válidos')
        c.execute('UPDATE pages SET is_exam_start=0 WHERE batch_id=?',(batch_id,))
        c.executemany('UPDATE pages SET is_exam_start=1 WHERE batch_id=? AND page_index=?',[(batch_id,i) for i in starts])
        return serialized_batch(c,batch_id)

@app.get('/api/batches/{batch_id}/pages/{page_index}/image')
def image_page(batch_id:str,page_index:int,thumb:bool=False,masked:bool=False):
    with connect() as c:
        checked_batch(c,batch_id)
        p=checked_page(c,batch_id,page_index)
        rs=[dict(x) for x in c.execute('SELECT * FROM regions WHERE page_id=?',(p['id'],))] if masked else []
    img=oriented_image(batch_id,p)
    if masked:
        img=redact(img,rs)
    if thumb:
        img.thumbnail((330,440),Image.Resampling.LANCZOS)
    return Response(content=png_bytes(img), media_type='image/png',headers={'Cache-Control':'no-store'})

@app.post('/api/batches/{batch_id}/pages/{page_index}/rotate')
def rotate_page(batch_id:str,page_index:int,clockwise:bool=True):
    with connect() as c:
        checked_batch(c,batch_id)
        p=checked_page(c,batch_id,page_index)
        w,h=p['width'],p['height']
        new_rotation=(p['rotation']+(90 if clockwise else -90))%360
        regions=[dict(r) for r in c.execute('SELECT * FROM regions WHERE page_id=?',(p['id'],))]
        for r in regions:
            box=rotate_rectangle((r['x1'],r['y1'],r['x2'],r['y2']),w,h,clockwise)
            c.execute('UPDATE regions SET x1=?,y1=?,x2=?,y2=?,updated_at=? WHERE id=?',(*box,now(),r['id']))
        c.execute('UPDATE pages SET rotation=?,width=?,height=? WHERE id=?',(new_rotation,h,w,p['id']))
        return serialized_batch(c,batch_id)

@app.post('/api/batches/{batch_id}/pages/{page_index}/regions',status_code=201)
def new_region(batch_id:str,page_index:int, data:RegionInput):
    with connect() as c:
        checked_batch(c,batch_id)
        page=checked_page(c,batch_id,page_index)
        if data.x2>page['width'] or data.y2>page['height']:
            raise HTTPException(422,'Región fuera de la página')
        r_id=uid()
        c.execute('INSERT INTO regions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(
            r_id,page['id'],data.kind,data.x1,data.y1,data.x2,data.y2,
            data.question_id,data.subquestion_id,data.reading_order,data.scope,data.value_text,data.note_text,now()))
        return {'id':r_id}

@app.put('/api/batches/{batch_id}/regions/{region_id}')
def update_region(batch_id:str,region_id:str,data:RegionInput):
    with connect() as c:
        checked_batch(c,batch_id)
        row=c.execute('SELECT r.*,p.width,p.height FROM regions r JOIN pages p ON p.id=r.page_id WHERE r.id=? AND p.batch_id=?',(region_id,batch_id)).fetchone()
        if not row:
            raise HTTPException(404,'Región inexistente')
        if data.x2>row['width'] or data.y2>row['height']:
            raise HTTPException(422,'Región fuera de la página')
        c.execute('''UPDATE regions SET kind=?,x1=?,y1=?,x2=?,y2=?,question_id=?,subquestion_id=?,reading_order=?,scope=?,value_text=?,note_text=?,updated_at=? WHERE id=?''',
            (data.kind,data.x1,data.y1,data.x2,data.y2,data.question_id,data.subquestion_id,data.reading_order,data.scope,data.value_text,data.note_text,now(),region_id))
        return {'ok':True}

@app.delete('/api/batches/{batch_id}/regions/{region_id}')
def delete_region(batch_id:str,region_id:str):
    with connect() as c:
        checked_batch(c,batch_id)
        r=c.execute('DELETE FROM regions WHERE id=? AND page_id IN (SELECT id FROM pages WHERE batch_id=?)',(region_id,batch_id))
        if not r.rowcount:
            raise HTTPException(404,'Región inexistente')
        return {'ok':True}

@app.post('/api/batches/{batch_id}/exports',status_code=201)
def create_export(batch_id:str,payload:ExportInput):
    if not payload.privacy_reviewed:
        raise HTTPException(422,'Revisá y confirmá las máscaras de privacidad antes de exportar')
    export_id=uid()
    with connect() as c:
        batch=checked_batch(c,batch_id)
        pages=[dict(r) for r in c.execute('SELECT * FROM pages WHERE batch_id=? ORDER BY page_index',(batch_id,))]
        regions=[dict(r) for r in c.execute('SELECT r.* FROM regions r JOIN pages p ON p.id=r.page_id WHERE p.batch_id=?',(batch_id,))]
        if not any(r['kind']!='privacidad' for r in regions):
            raise HTTPException(422,'Primero etiquetá al menos una región académica')
        outdir=DATA_DIR/'exports'
        outfile=outdir/f'{export_id}.zip'
        try:
            report=export_zip(batch,pages,regions,export_id,payload.mode,outfile)
        except Exception:
            outfile.unlink(missing_ok=True)
            raise
        c.execute('INSERT INTO exports VALUES (?,?,?,?,?)',(export_id,batch_id,payload.mode,str(outfile),now()))
    return {'export_id':export_id,**report,'download_url':f'/api/exports/{export_id}/download'}

@app.get('/api/exports/{export_id}/download')
def download_export(export_id:str):
    with connect() as c:
        row=c.execute('SELECT * FROM exports WHERE id=?',(export_id,)).fetchone()
        if not row:
            raise HTTPException(404,'Exportación inexistente')
        p=Path(row['file_path'])
        if not p.is_file():
            raise HTTPException(404,'El archivo de exportación ya no existe')
    return FileResponse(p,media_type='application/zip',filename=f'exportacion_{export_id[:8]}.zip')
