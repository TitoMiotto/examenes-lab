"""Required response scores and reviewable deterministic warnings, without relabeling."""
import io
import json
import zipfile
from playwright.sync_api import expect
from editor_browser import main


def check_validation(page, api, base, batch_id, ids):
    score = {'kind': 'calificacion', 'question_id': 'P2', 'scope': 'pregunta',
             'x1': 650, 'y1': 50, 'x2': 780, 'y2': 100, 'score_value': 0, 'score_denominator': 10}
    assert api.post(f'/api/batches/{batch_id}/pages/0/regions', data=score).status == 201
    report = api.get(f'/api/batches/{batch_id}/validation').json()
    assert any(i['code'] == 'missing_grade' for i in report['errors'])
    assert api.post(f'/api/batches/{batch_id}/exports', data={
        'privacy_reviewed': True, 'warnings_reviewed': True,
        'validation_fingerprint': report['fingerprint']}).status == 422
    page.goto(base)
    page.locator('.recent-row').first.click()
    page.get_by_role('button', name='Exportar', exact=True).click()
    expect(page.locator('.annotation-review')).to_contain_text('1 errores')
    page.locator('.validation-error').filter(has_text='falta una calificación').get_by_role('button', name='Marcar calificación').click()
    expect(page.get_by_role('button', name='Calificación docente', exact=True)).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('.image-loading')).to_have_count(0)
    canvas = page.locator('.konvajs-content').bounding_box()
    page.mouse.move(canvas['x']+650, canvas['y']+150)
    page.mouse.down();page.mouse.move(canvas['x']+740, canvas['y']+190, steps=8);page.mouse.up()
    expect(page.locator('.toast .animate-spin')).to_have_count(0)
    # P2 already had a grade: targeted action must create P1, rather than next P3.
    expect(page.get_by_role('combobox', name='Pregunta', exact=True)).to_have_value('P1')
    count_before=len(api.get(f'/api/batches/{batch_id}').json()['pages'][0]['regions'])
    page.locator('.region-row').filter(has_text='Respuesta').first.click()
    page.locator('.response-score').get_by_role('button', name='Marcar calificación').click()
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_be_focused()
    assert len(api.get(f'/api/batches/{batch_id}').json()['pages'][0]['regions'])==count_before
    page.get_by_role('textbox', name='Denominador', exact=True).fill('10')
    page.get_by_role('textbox', name='Valor obtenido', exact=True).fill('7')
    expect(page.locator('.stage-foot')).to_contain_text('Todos los cambios guardados')
    page.locator('.region-row').filter(has_text='Respuesta').first.click()
    expect(page.locator('.response-score')).to_contain_text('7 / 10')
    # Same pixels can legitimately answer a different question.
    shared = {'kind': 'subpregunta', 'question_id': 'P2', 'subquestion_id': 'a', 'reading_order': 1,
              'x1': 180, 'y1': 250, 'x2': 700, 'y2': 700}
    result = api.post(f'/api/batches/{batch_id}/pages/0/regions', data=shared)
    assert result.status == 201, result.text()
    shared_id = result.json()['id']
    page.reload();page.locator('.recent-row').first.click()
    page.get_by_role('button', name='Exportar', exact=True).click()
    expect(page.locator('.annotation-review')).to_contain_text('0 errores')
    expect(page.locator('.validation-warning').filter(has_text='respuesta compartida')).to_be_visible()
    for index in range(3):
        page.locator('.page-tile').nth(index).click()
        page.locator('.per-page-review input').check()
    page.locator('.right-body > .review-check input').check()
    expect(page.get_by_role('button', name='Generar exportación')).to_be_disabled()
    page.locator('.annotation-review input').check()
    with page.expect_response(lambda r: '/exports' in r.url and r.request.method == 'POST') as capture:
        page.get_by_role('button', name='Generar exportación').click()
    response = capture.value
    assert response.status == 201, response.text()
    with zipfile.ZipFile(io.BytesIO(api.get(response.json()['download_url']).body())) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['schema_version'] == 4
        assert manifest['revision_anotaciones']['advertencias_confirmadas']
        r = next(r for r in manifest['regiones'] if r['region_id'] == shared_id)
        assert r['pregunta_id'] == 'P2'  # never automatically relabel shared content
        field = next(f for f in manifest['preguntas'] if shared_id in f['regiones'])
        assert field['alcance_calificacion'] == 'pregunta'
        assert field['calificaciones']
    # An edit from another client must invalidate even an already visible acceptance.
    assert api.put(f'/api/batches/{batch_id}/regions/{shared_id}', data={**shared, 'x1': 181}).status==200
    with page.expect_response(lambda r: '/exports' in r.url and r.request.method == 'POST') as rejected:
        page.get_by_role('button', name='Generar exportación').click()
    assert rejected.value.status==409
    expect(page.locator('.download-link')).to_have_count(0)
    expect(page.locator('.annotation-review')).to_contain_text('0 errores')
    expect(page.locator('.annotation-review input')).not_to_be_checked()
    page.locator('.page-tile').first.click()
    page.get_by_role('button', name='Regiones', exact=True).click()
    page.locator('.region-row').filter(has_text='P2.a').click()
    page.get_by_label('Orden de fragmentos de P2.a').fill('2')
    expect(page.locator('.stage-foot')).to_contain_text('Todos los cambios guardados')
    page.get_by_role('button', name='Exportar', exact=True).click()
    expect(page.locator('.annotation-review')).to_contain_text('0 errores')
    expect(page.locator('.annotation-review input')).not_to_be_checked()
    expect(page.get_by_role('button', name='Generar exportación')).to_be_disabled()
    print('PASS: mandatory response grade, targeted score entry, inherited question grade, intentional shared answers, warning acknowledgment, export, invalidation after edits')


if __name__ == '__main__':
    main(check_validation)
