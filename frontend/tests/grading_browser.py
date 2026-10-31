"""Teacher score browser checks. Uses the editor's isolated server harness."""
import io
import json
import zipfile
from playwright.sync_api import expect
from editor_browser import main


def check_grades(page, api, base, batch_id, ids):
    response = api.put(f'/api/batches/{batch_id}/boundaries', data={'starts': [0, 1, 2]})
    assert response.status == 200, response.text()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.locator('.recent-row').first.click()
    expect(page.locator('.image-loading')).to_have_count(0)

    def saved():
        expect(page.locator('.stage-foot')).to_contain_text('Todos los cambios guardados')

    def draw():
        page.get_by_role('button', name='Calificación docente', exact=True).click()
        rect = page.locator('.konvajs-content').bounding_box()
        page.mouse.move(rect['x']+620, rect['y']+180)
        page.mouse.down()
        page.mouse.move(rect['x']+710, rect['y']+230, steps=8)
        page.mouse.up()
        expect(page.locator('.toast .animate-spin')).to_have_count(0)
        saved()
        expect(page.get_by_role('button', name='Calificación docente', exact=True)).to_have_attribute('aria-pressed', 'true')
        expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_be_focused()
        assert 'Examen completo' not in page.get_by_role('combobox', name='Alcance de la calificación').inner_text()

    def question(expected):
        expect(page.get_by_role('combobox', name='Pregunta', exact=True)).to_have_value(expected)

    def enter(value, denominator=None):
        if denominator is not None:
            page.get_by_role('textbox', name='Denominador', exact=True).fill(denominator)
            saved()
        page.get_by_role('textbox', name='Valor obtenido', exact=True).fill('')
        page.get_by_role('textbox', name='Valor obtenido', exact=True).press_sequentially(value, delay=10)
        saved()

    draw(); question('P1'); enter('7,5', '10')
    draw(); question('P2'); enter('4', '5')
    page.locator('.page-tile').nth(1).click()
    expect(page.locator('.image-loading')).to_have_count(0)
    draw(); question('P1')
    expect(page.get_by_role('textbox', name='Denominador', exact=True)).to_have_value('10')
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_have_value('')
    enter('6')
    draw(); question('P2')
    expect(page.get_by_role('textbox', name='Denominador', exact=True)).to_have_value('5')
    enter('0')
    draw(); question('P3')
    page.get_by_role('button', name='Exportar', exact=True).click()
    expect(page.locator('.grade-pending')).to_contain_text('1 calificaciones pendientes')
    expect(page.get_by_role('button', name='Generar exportación')).to_be_disabled()
    page.locator('.grade-pending button').click()
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_be_focused()
    # Teacher inciso numbering is independent of the existing student regions.
    page.get_by_role('combobox', name='Alcance de la calificación').select_option('inciso'); saved()
    page.get_by_role('combobox', name='Pregunta', exact=True).select_option('P1'); saved()
    expect(page.get_by_role('combobox', name='Inciso', exact=True)).to_have_value('a')
    enter('1', '3')
    draw(); question('P1')
    expect(page.get_by_role('combobox', name='Inciso', exact=True)).to_have_value('b')
    enter('0', '2')
    page.locator('.page-tile').nth(2).click()
    expect(page.locator('.image-loading')).to_have_count(0)
    draw(); question('P1')
    expect(page.get_by_role('combobox', name='Inciso', exact=True)).to_have_value('a')
    expect(page.get_by_role('textbox', name='Denominador', exact=True)).to_have_value('3')
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_have_value('')
    enter('2')
    draw()
    expect(page.get_by_role('combobox', name='Inciso', exact=True)).to_have_value('b')
    expect(page.get_by_role('textbox', name='Denominador', exact=True)).to_have_value('2')
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_have_value('')
    enter('1')
    page.reload()
    page.locator('.recent-row').first.click()
    page.locator('.page-tile').nth(2).click()
    page.locator('.region-row').filter(has_text='P1.b').click()
    expect(page.get_by_role('textbox', name='Valor obtenido', exact=True)).to_have_value('1')
    expect(page.get_by_role('textbox', name='Denominador', exact=True)).to_have_value('2')
    page.get_by_role('button', name='Exportar', exact=True).click()
    expect(page.locator('.annotation-review')).to_contain_text('0 errores')
    for index in range(3):
        page.locator('.page-tile').nth(index).click()
        page.locator('.per-page-review input').check()
    page.locator('.right-body > .review-check input').check()
    if page.locator('.annotation-review input').count():
        page.locator('.annotation-review input').check()
    with page.expect_response(lambda r: '/exports' in r.url and r.request.method == 'POST') as response:
        page.get_by_role('button', name='Generar exportación').click()
    result = response.value
    assert result.status == 201, result.text()
    with zipfile.ZipFile(io.BytesIO(api.get(result.json()['download_url']).body())) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        grades = [r for r in manifest['regiones'] if r['tipo'] == 'calificacion']
        assert len(grades) == 8
        assert [(r['valor'], r['denominador']) for r in grades] == [(7.5, 10), (4, 5), (6, 10), (0, 5), (1, 3), (0, 2), (2, 3), (1, 2)]
        assert all(r['alcance'] in ('pregunta', 'inciso') and r['pregunta_id'] for r in grades)
        assert archive.testzip() is None
    assert not errors, errors
    print('PASS: grade numbering, no exam total, autofocus, comma decimals, zero scores, per-field denominator reuse across exams, pending grades, persistence, ZIP results')


if __name__ == '__main__':
    main(check_grades)
