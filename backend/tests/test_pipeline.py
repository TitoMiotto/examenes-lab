"""Pruebas sin GPU: ingestión, divisores, rotación, privacidad y contrato OCR."""
import io
import json
import os
import tempfile
import zipfile
from pathlib import Path

from PIL import Image
import fitz

# Aislar el directorio de datos ANTES de importar app.db
TEST_DIR = tempfile.TemporaryDirectory(prefix='examenes-tests-')
os.environ['EXAMENES_DATA_DIR'] = TEST_DIR.name
from fastapi.testclient import TestClient  # noqa:E402
from app.main import app  # noqa:E402


def pdf_test() -> bytes:
    doc=fitz.open()
    for i in range(3):
        p=doc.new_page(width=200,height=120)
        p.draw_rect(fitz.Rect(15,20,160,90),color=(0,0,0),fill=(1,1,1))
        p.insert_text((25,60),f'ESTUDIANTE {i}',fontsize=10)
    return doc.tobytes()


def test_full_pipeline():
    with TestClient(app) as client:
        pdf=pdf_test()
        response=client.post('/api/batches?dpi=100',files={'file':('lote-alumnos.pdf',pdf,'application/pdf')})
        assert response.status_code==201,response.text
        batch_id=response.json()['id']
        detail=client.get(f'/api/batches/{batch_id}').json()
        assert detail['pages_count']==3
        assert detail['exams_count']==1
        assert 'original_filename' not in detail
        # Separación del lote en dos exámenes
        resp=client.put(f'/api/batches/{batch_id}/boundaries',json={'starts':[0,2]})
        assert resp.status_code==200,resp.text
        assert resp.json()['exams_count']==2
        # Error si no comienza desde página 0
        assert client.put(f'/api/batches/{batch_id}/boundaries',json={'starts':[2]}).status_code==422
        page=resp.json()['pages'][0]
        w,h=page['width'],page['height']
        # Marcar un texto, y una máscara que ocupa parte del mismo texto
        academic={'kind':'respuesta','x1':10,'y1':15,'x2':160,'y2':95,'question_id':'P1','reading_order':1}
        a=client.post(f'/api/batches/{batch_id}/pages/0/regions',json=academic)
        assert a.status_code==201,a.text
        academic_id=a.json()['id']
        privacy={'kind':'privacidad','x1':16,'y1':25,'x2':150,'y2':65}
        b=client.post(f'/api/batches/{batch_id}/pages/0/regions',json=privacy)
        assert b.status_code==201,b.text
        # Invalida un inciso sin identificador de inciso
        invalid={**academic,'kind':'subpregunta'}
        assert client.post(f'/api/batches/{batch_id}/pages/0/regions',json=invalid).status_code==422
        # Rotar 90 grados a la derecha transforma tanto las dimensiones como los rectángulos
        rotated=client.post(f'/api/batches/{batch_id}/pages/0/rotate?clockwise=true')
        assert rotated.status_code==200,rotated.text
        rotated_page=rotated.json()['pages'][0]
        assert rotated_page['width']==h and rotated_page['height']==w
        ar=next(r for r in rotated_page['regions'] if r['id']==academic_id)
        assert (ar['x1'],ar['y1'],ar['x2'],ar['y2'])==(h-95,10,h-15,160)
        # 3 rotaciones restantes recuperan coordenadas originales
        for _ in range(3):
            rotated=client.post(f'/api/batches/{batch_id}/pages/0/rotate?clockwise=true')
        ar=next(r for r in rotated.json()['pages'][0]['regions'] if r['id']==academic_id)
        assert (ar['x1'],ar['y1'],ar['x2'],ar['y2'])==(10,15,160,95)
        # No permitimos exportar sin revisión visual
        assert client.post(f'/api/batches/{batch_id}/exports',json={'privacy_reviewed':False}).status_code==422
        res=client.post(f'/api/batches/{batch_id}/exports',json={'privacy_reviewed':True,'mode':'completo'})
        assert res.status_code==201,res.text
        response=client.get(res.json()['download_url'])
        assert response.status_code==200
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            names=z.namelist()
            assert 'manifest.json' in names
            assert len([n for n in names if n.startswith('paginas_desidentificadas/')])==3
            assert len([n for n in names if n.startswith('recortes/')])==1
            assert not any('original.pdf' in n or 'lote-alumnos' in n for n in names)
            manifest=json.loads(z.read('manifest.json'))
            assert len(manifest['examenes'])==2
            assert sum(1 for r in manifest['regiones'] if r['tipo']=='privacidad')==1
            crop_path=next(r['recorte'] for r in manifest['regiones'] if r['tipo']=='respuesta')
            crop=Image.open(io.BytesIO(z.read(crop_path)))
            # pixel de la máscara dentro del recorte es opaco y negro
            assert crop.getpixel((30-10,30-15))==(0,0,0)
        # El OCR-only no incluye páginas enteras
        ocr=client.post(f'/api/batches/{batch_id}/exports',json={'privacy_reviewed':True,'mode':'ocr'})
        assert ocr.status_code==201
        with zipfile.ZipFile(io.BytesIO(client.get(ocr.json()['download_url']).content)) as z:
            assert not any(n.startswith('paginas_desidentificadas/') for n in z.namelist())
            assert any(n.startswith('recortes/estudiantes/') for n in z.namelist())
        # El PDF original permanece sin cambios, por byte
        from app.services import batch_dir
        assert (batch_dir(batch_id)/'original.pdf').read_bytes()==pdf


def test_orientation_math():
    from app.services import rotate_rectangle
    box=(1,2,40,70)
    result=box
    w,h=200,120
    for _ in range(4):
        result=rotate_rectangle(result,w,h,True)
        w,h=h,w
    assert result==box


def test_export_reading_sequences_per_question():
    with TestClient(app) as client:
        batch_id = client.post('/api/batches?dpi=100', files={
            'file': ('synthetic.pdf', pdf_test(), 'application/pdf')}).json()['id']
        client.put(f'/api/batches/{batch_id}/boundaries', json={'starts': [0, 2]})
        ids = []
        for page, question, order in [(0, 'P1', 1), (0, 'P2', 1), (1, 'P1', 2), (2, 'P1', 1)]:
            result = client.post(f'/api/batches/{batch_id}/pages/{page}/regions', json={
                'kind': 'respuesta', 'x1': 10, 'y1': 10, 'x2': 80, 'y2': 80,
                'question_id': question, 'reading_order': order})
            assert result.status_code == 201, result.text
            ids.append(result.json()['id'])
        for page, inciso, order in [(0, 'a', 1), (1, 'a', 2), (0, 'b', 1)]:
            result = client.post(f'/api/batches/{batch_id}/pages/{page}/regions', json={
                'kind': 'subpregunta', 'x1': 20, 'y1': 20, 'x2': 60, 'y2': 60,
                'question_id': 'P1', 'subquestion_id': inciso, 'reading_order': order})
            assert result.status_code == 201, result.text
            ids.append(result.json()['id'])
        result = client.post(f'/api/batches/{batch_id}/exports', json={
            'privacy_reviewed': True, 'mode': 'ocr'})
        assert result.status_code == 201, result.text
        with zipfile.ZipFile(io.BytesIO(client.get(result.json()['download_url']).content)) as archive:
            manifest = json.loads(archive.read('manifest.json'))
        assert manifest['schema_version'] == 2
        assert manifest['orden_lectura_por'] == 'campo'
        groups = {(g['examen_id'], g['pregunta_id'], g['tipo'], g['inciso_id']): g['regiones']
                  for g in manifest['preguntas']}
        assert groups == {('EX_0001', 'P1', 'respuesta', None): [ids[0], ids[2]],
                          ('EX_0001', 'P2', 'respuesta', None): [ids[1]],
                          ('EX_0002', 'P1', 'respuesta', None): [ids[3]],
                          ('EX_0001', 'P1', 'subpregunta', 'a'): [ids[4], ids[5]],
                          ('EX_0001', 'P1', 'subpregunta', 'b'): [ids[6]]}
