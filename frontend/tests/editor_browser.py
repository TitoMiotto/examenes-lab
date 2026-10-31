"""Browser regression checks. Run with Python + playwright and Chromium installed.
Starts isolated servers and temporary data; never touches development documents.
"""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
PYTHON = ROOT / 'backend/.venv/bin/python'


def port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def ready(url, process):
    for _ in range(150):
        if process.poll() is not None:
            raise RuntimeError(f'Server exited: {url}')
        try:
            with urllib.request.urlopen(url, timeout=1):
                return
        except OSError:
            time.sleep(.1)
    raise RuntimeError(f'Server not ready: {url}')


def check(page, api, base, batch_id, ids):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.locator('.recent-row').first.click()
    expect(page.locator('.image-loading')).to_have_count(0)

    def data():
        return api.get(f'/api/batches/{batch_id}').json()['pages'][0]

    def region(rid):
        return next(r for r in data()['regions'] if r['id'] == rid)

    def saved():
        expect(page.locator('.stage-foot')).to_contain_text('Todos los cambios guardados')

    def select(rid):
        r = region(rid)
        x, y = point((r['x1']+r['x2'])/2, (r['y1']+r['y2'])/2)
        page.mouse.click(x, y)
        expect(page.locator('fieldset .id-chip')).to_have_text(rid[:8].upper())

    def point(x, y):
        bounds = page.locator('.konvajs-content').bounding_box()
        scale = (bounds['width']-32)/data()['width']
        return bounds['x']+16+x*scale, bounds['y']+16+y*scale

    def drag(x, y, dx, dy):
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x+dx, y+dy, steps=10)
        page.mouse.up()
        saved()

    # Full-width document, vertical scrolling, no central toolbar.
    host = page.locator('.canvas-host').bounding_box()
    bounds = page.locator('.konvajs-content').bounding_box()
    assert abs(bounds['width']-(host['width']-15)) < 20, (host, bounds)
    assert bounds['height'] > host['height']
    assert page.locator('.main-stage .editor-toolbar').count() == 0
    assert page.locator('.main-stage .tools-line').count() == 0
    # Repeatedly switch between nearby siblings and the containing response.
    for _ in range(3):
        for rid in [ids['a'], ids['b'], ids['parent'], ids['b'], ids['a']]:
            select(rid)
    # A response's corner handle must work even when a child occupies that corner.
    select(ids['parent'])
    parent_before=region(ids['parent']);child_before=region(ids['corner'])
    drag(*point(parent_before['x2'],parent_before['y1']),5,-5)
    assert region(ids['parent'])['x2']>parent_before['x2']
    assert region(ids['parent'])['y1']<parent_before['y1']
    assert region(ids['corner'])==child_before
    select(ids['a'])
    # Drag the unselected sibling, without a prior click. Only that region moves.
    before = region(ids['b'])
    untouched = region(ids['a'])
    x, y = point((before['x1']+before['x2'])/2, (before['y1']+before['y2'])/2)
    drag(x, y, 12, 9)
    expect(page.locator('fieldset .id-chip')).to_have_text(ids['b'][:8].upper())
    assert region(ids['b'])['x1'] > before['x1']
    assert region(ids['a']) == untouched

    # All eight resize handles, including those overlapped by another region.
    # Independent expected edges ensure a failed handle cannot pass as a drag.
    directions = [('top-left',-7,-7),('top-center',0,-7),('top-right',7,-7),
                  ('middle-right',7,0),('bottom-right',7,7),('bottom-center',0,7),
                  ('bottom-left',-7,7),('middle-left',-7,0)]
    for anchor, dx, dy in directions:
        before = region(ids['b'])
        x = before['x1'] if 'left' in anchor else before['x2'] if 'right' in anchor else (before['x1']+before['x2'])/2
        y = before['y1'] if 'top' in anchor else before['y2'] if 'bottom' in anchor else (before['y1']+before['y2'])/2
        drag(*point(x,y), dx,dy)
        after = region(ids['b'])
        if dx:
            edge = 'x1' if 'left' in anchor else 'x2'
            assert (after[edge]-before[edge])*dx>0,(anchor,before,after)
        else:
            assert (after['x1'],after['x2']) == (before['x1'],before['x2']),anchor
        if dy:
            edge = 'y1' if 'top' in anchor else 'y2'
            assert (after[edge]-before[edge])*dy>0,(anchor,before,after)
        else:
            assert (after['y1'],after['y2']) == (before['y1'],before['y2']),anchor
    # Corner handles must also work at the page boundary (gutter prevents clipping).
    select(ids['edge'])
    drag(*point(0,0),8,8)
    assert region(ids['edge'])['x1']>0 and region(ids['edge'])['y1']>0
    # Scroll, zoom, then select and drag with transformed coordinates.
    page.locator('.canvas-scroller').evaluate('(el)=>el.scrollTop=200')
    page.get_by_title('Acercar').click()
    select(ids['a'])
    before = region(ids['a'])
    drag(*point((before['x1']+before['x2'])/2,(before['y1']+before['y2'])/2),10,10)
    assert region(ids['a'])['x1']>before['x1']
    page.locator('.canvas-scroller').evaluate('(el)=>el.scrollTop=0')

    def draw(kind, box):
        page.get_by_role('button',name=kind,exact=True).click()
        x,y=point(box[0],box[1]);end=point(box[2],box[3])
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(*end,steps=10);page.mouse.up()
        expect(page.locator('.toast .animate-spin')).to_have_count(0)
        expect(page.get_by_role('button',name=kind,exact=True)).to_have_attribute('aria-pressed','true')
        expect(page.locator('.stage-foot')).to_contain_text('Todos los cambios guardados')

    # Active annotation tool survives consecutive creations for every label.
    for kind in ['Respuesta','Subpregunta','Calificación docente','Observación docente','Privacidad']:
        count=len(data()['regions'])
        first,second=((400,450,440,480),(450,450,490,480)) if kind=='Subpregunta' else ((300,260,340,295),(350,260,390,295))
        draw(kind,first)
        if kind=='Respuesta':
            expect(page.get_by_role('combobox',name='Pregunta',exact=True)).to_have_value('P2')
        if kind=='Subpregunta':
            expect(page.get_by_role('combobox',name='Inciso',exact=True)).to_have_value('d')
        draw(kind,second)
        if kind=='Respuesta':
            expect(page.get_by_role('combobox',name='Pregunta',exact=True)).to_have_value('P3')
            # Reassign to an existing response field to continue its fragment sequence.
            page.get_by_role('combobox',name='Pregunta',exact=True).select_option('P1');saved()
            expect(page.get_by_label('Orden de fragmentos de P1')).to_have_value('2')
        if kind=='Subpregunta':
            expect(page.get_by_role('combobox',name='Inciso',exact=True)).to_have_value('e')
        assert len(data()['regions'])==count+2,kind
    # Subquestion order responds to the inciso, independently of response P1.
    page.get_by_role('button',name='Seleccionar',exact=True).click()
    select(ids['b'])
    expect(page.get_by_label('Orden de fragmentos de P1.b')).to_have_value('1')
    page.get_by_role('combobox',name='Inciso',exact=True).select_option('a');saved()
    # Only the two existing a fragments belong to this field.
    expect(page.get_by_label('Orden de fragmentos de P1.a')).to_have_value('3')
    assert not errors,errors
    print('PASS: nearby selection, parent handle over child, unselected center drag, all 8 handles, page-edge handles, zoom + scroll, persistent tools, subquestion order')


def main(check_fn=check):
    with tempfile.TemporaryDirectory(prefix='examenes-editor-regression-') as temp:
        backend_port, frontend_port = port(), port()
        backend_url=f'http://127.0.0.1:{backend_port}'
        frontend_url=f'http://127.0.0.1:{frontend_port}'
        log=open(Path(temp)/'servers.log','w+')
        processes=[]
        try:
            backend=subprocess.Popen([str(PYTHON),'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(backend_port)],cwd=ROOT/'backend',env={**os.environ,'EXAMENES_DATA_DIR':temp+'/data'},stdout=log,stderr=log)
            processes.append(backend);ready(backend_url+'/api/health',backend)
            frontend=subprocess.Popen(['node',str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',str(frontend_port),'--strictPort'],cwd=ROOT/'frontend',stdout=log,stderr=log)
            processes.append(frontend);ready(frontend_url,frontend)
            pdf=Path(temp)/'synthetic.pdf'
            subprocess.run([str(PYTHON),'-c',"import fitz,sys;d=fitz.open();[d.new_page(width=600,height=1000) for _ in range(3)];d.save(sys.argv[1])",str(pdf)],check=True)
            with sync_playwright() as pw:
                browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
                api=pw.request.new_context(base_url=backend_url)
                response=api.post('/api/batches?dpi=100',multipart={'file':{'name':'synthetic.pdf','mimeType':'application/pdf','buffer':pdf.read_bytes()}})
                assert response.status==201,response.text()
                batch_id=response.json()['id']
                ids={}
                fixtures=[('parent','respuesta',None,(60,180,780,850)),
                          ('a','subpregunta','a',(100,260,350,420)),
                          ('b','subpregunta','b',(354,260,600,420)),
                          ('a2','subpregunta','a',(100,450,300,550)),
                          ('corner','subpregunta','c',(740,180,780,230)),
                          ('edge','privacidad',None,(0,0,90,90))]
                for key,kind,inciso,box in fixtures:
                    response=api.post(f'/api/batches/{batch_id}/pages/0/regions',data={
                        'kind':kind,'x1':box[0],'y1':box[1],'x2':box[2],'y2':box[3],
                        'question_id':'P1' if kind!='privacidad' else None,'subquestion_id':inciso,
                        'reading_order':2 if key=='a2' else 1 if kind!='privacidad' else None})
                    assert response.status==201,response.text()
                    ids[key]=response.json()['id']
                page=browser.new_page(viewport={'width':1440,'height':850})
                page.route('**/api/**',lambda route: route.fulfill(response=route.fetch(url=route.request.url.replace(frontend_url,backend_url))))
                check_fn(page,api,frontend_url,batch_id,ids)
                browser.close()
        except Exception:
            log.flush();print(Path(log.name).read_text()[-4000:]);raise
        finally:
            for process in reversed(processes):
                process.terminate()
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:process.kill();process.wait()
            log.close()

if __name__=='__main__':
    main()
