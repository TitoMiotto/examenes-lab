"""Procesamiento de páginas, coordenadas, privacidad y empaquetado."""
import hashlib
import io
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import fitz
from .db import DATA_DIR
from .grading import grade_problem, covering_grades

Image.MAX_IMAGE_PIXELS = 150_000_000


def batch_dir(batch_id: str) -> Path:
    return DATA_DIR / 'private' / batch_id


def render_pdf(pdf: Path, destination: Path, dpi: int):
    (destination / 'pages').mkdir(parents=True, exist_ok=True)
    records = []
    with fitz.open(pdf) as doc:
        if len(doc) < 1 or len(doc) > 250:
            raise ValueError('El PDF debe tener entre 1 y 250 páginas')
        if doc.needs_pass:
            raise ValueError('No se admiten PDF protegidos con contraseña')
        for i, p in enumerate(doc):
            pm = p.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB, annots=True)
            dest = destination / 'pages' / f'{i:04d}.png'
            pm.save(str(dest))
            records.append({'page_index': i, 'width': pm.width, 'height': pm.height})
    return records


def source_image(batch_id: str, page_index: int) -> Path:
    return batch_dir(batch_id) / 'pages' / f'{page_index:04d}.png'


def oriented_image(batch_id: str, page: dict) -> Image.Image:
    img = Image.open(source_image(batch_id, page['page_index'])).convert('RGB')
    if page['rotation']:
        img = img.rotate(-page['rotation'], expand=True, resample=Image.Resampling.NEAREST)
    return img


def rotate_rectangle(box: tuple[int, int, int, int], w: int, h: int, clockwise: bool):
    x1,y1,x2,y2 = box
    if clockwise:
        return h-y2, x1, h-y1, x2
    return y1, w-x2, y2, w-x1


def redact(img: Image.Image, regions: list[dict]) -> Image.Image:
    # Copia: todas las máscaras se aplican ANTES de cualquier extracción.
    result = img.copy()
    draw = ImageDraw.Draw(result)
    for r in regions:
        if r['kind'] == 'privacidad':
            draw.rectangle((r['x1'],r['y1'],r['x2'],r['y2']), fill=(0,0,0), width=0)
    return result


def png_bytes(img: Image.Image) -> bytes:
    buff = io.BytesIO()
    # Se codifica de cero, sin EXIF ni metadatos heredados del original.
    img.save(buff, format='PNG', optimize=True)
    return buff.getvalue()


def export_zip(batch: dict, pages: list[dict], regions: list[dict], export_id: str, mode: str, output: Path, validation: dict | None = None):
    if any(grade_problem(r) for r in regions):
        raise ValueError('Hay calificaciones incompletas o sin pregunta/inciso')
    exam_regions = {}
    current_exam = 0
    for page in pages:
        if page['is_exam_start']:
            current_exam += 1
        exam_regions.setdefault(current_exam, []).extend(r for r in regions if r['page_id'] == page['id'])
    for members in exam_regions.values():
        if any(r['kind'] in ('respuesta', 'subpregunta') and not covering_grades(members, r) for r in members):
            raise ValueError('Cada respuesta debe tener una calificación completa')
    by_page = {}
    for r in regions:
        by_page.setdefault(r['page_id'], []).append(r)
    starts = 0
    exam_code = ''
    exam_page_index = 0
    exam_list = []
    items = []
    file_count = 0
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=4) as z:
        for p in pages:
            if p['is_exam_start']:
                starts += 1
                exam_code = f'EX_{starts:04d}'
                exam_page_index = 0
                exam_list.append({'examen_id': exam_code, 'primera_pagina': p['page_index'] + 1})
            exam_page_index += 1
            page_code = f'{exam_code}_P{exam_page_index:03d}'
            page_regions = by_page.get(p['id'],[])
            original = oriented_image(batch['id'], p)
            clean = redact(original, page_regions)
            if mode == 'completo':
                z.writestr(f'paginas_desidentificadas/{page_code}.png',png_bytes(clean))
                file_count += 1
            for r in page_regions:
                meta = {
                    'region_id':r['id'], 'examen_id':exam_code,
                    'pagina_original':p['page_index']+1, 'pagina_en_examen':exam_page_index,
                    'tipo':r['kind'], 'bbox_px':[r['x1'],r['y1'],r['x2'],r['y2']],
                }
                if r['kind'] != 'privacidad':
                    meta.update({
                        'pregunta_id':r['question_id'], 'inciso_id':r['subquestion_id'],
                        'orden':r['reading_order'], 'alcance':r['scope'],
                        'valor_manual':r['value_text'], 'observacion_manual':r['note_text']
                    })
                    if r['kind'] == 'calificacion':
                        meta.update({'valor': r['score_value'], 'denominador': r['score_denominator']})
                    folder = 'estudiantes' if r['kind'] in ('respuesta','subpregunta') else 'docentes'
                    filename = f'recortes/{folder}/{r["id"]}.png'
                    crop = clean.crop((r['x1'],r['y1'],r['x2'],r['y2']))
                    z.writestr(filename,png_bytes(crop))
                    file_count += 1
                    meta['recorte'] = filename
                items.append(meta)
        # Each response or subquestion field has its own fragment sequence across pages.
        questions = {}
        for item in items:
            if item['tipo'] not in ('respuesta', 'subpregunta'):
                continue
            key = (item['examen_id'], item['pregunta_id'], item['tipo'],
                   item['inciso_id'] if item['tipo'] == 'subpregunta' else None)
            questions.setdefault(key, []).append(item)
        question_sequences = []
        for (exam, question, kind, subquestion), members in questions.items():
            matching = [item for item in items if item['tipo'] == 'calificacion'
                        and item['examen_id'] == exam and item['pregunta_id'] == question]
            own = [item for item in matching if kind == 'subpregunta' and item['alcance'] == 'inciso' and item['inciso_id'] == subquestion]
            scores = own or [item for item in matching if item['alcance'] == 'pregunta']
            question_sequences.append({
                'examen_id': exam, 'pregunta_id': question, 'tipo': kind, 'inciso_id': subquestion,
                'calificaciones': [item['region_id'] for item in scores],
                'alcance_calificacion': 'inciso' if own else 'pregunta',
                'regiones': [item['region_id'] for item in sorted(members, key=lambda item: (item['orden'], item['pagina_original'], item['region_id']))],
            })
        manifest = {
            'schema_version':4,
            'exportacion_id':export_id,
            'lote_id_anonimo':batch['id'],
            'modo':mode,
            'idioma':'es',
            'paginas':len(pages),
            'examenes':exam_list,
            'regiones':items,
            'orden_lectura_por':'campo',
            'preguntas':question_sequences,
            'politica_privacidad':'Mascaras opacas sobre pixeles; original no incluido. Requiere revision visual previa.'
        }
        if validation is not None:
            manifest['revision_anotaciones'] = {'advertencias_confirmadas': bool(validation['warnings']),
                                                'advertencias': validation['warnings']}
        z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf-8'))
    return {'file_count': file_count, 'regions_count':len(items), 'exams_count':len(exam_list)}
