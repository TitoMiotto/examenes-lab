from copy import deepcopy

from app.validation import validate_batch


def region(rid, kind='respuesta', question='P1', inciso=None, order=1, **extra):
    return dict(id=rid, kind=kind, question_id=question, subquestion_id=inciso,
                reading_order=order, scope=None, score_value=None, score_denominator=None,
                x1=100, y1=200, x2=600, y2=600, **extra)


def grade(rid='grade', question='P1', scope='pregunta', inciso=None, value=0, denominator=10):
    r = region(rid, 'calificacion', question, inciso, None)
    r.update(scope=scope, score_value=value, score_denominator=denominator,
             x1=650, y1=50, x2=900, y2=100)
    return r


def page(index, regions, exam='EX_0001'):
    return dict(id=f'page{index}', page_index=index, exam_id=exam, width=1000, height=1400,
                rotation=0, is_exam_start=int(index == 0 or exam != 'EX_0001'), regions=regions)


def report(*pages):
    return validate_batch({'pages': list(pages)})


def codes(result, severity='warnings'):
    return {r['code'] for r in result[severity]}


def test_every_answer_field_requires_one_complete_score_not_one_per_fragment():
    a, b = region('a'), region('b', order=2)
    result = report(page(0, [a]), page(1, [b]))
    assert codes(result, 'errors') == {'missing_grade'}
    assert result['errors'][0]['region_ids'] == ['a', 'b']
    assert not report(page(0, [a, grade()]), page(1, [b]))['errors']


def test_question_score_covers_incisos_without_inventing_individual_marks():
    sub = region('sub', 'subpregunta', inciso='a')
    assert not report(page(0, [region('answer'), sub, grade()]))['errors']
    # An inciso's own score cannot replace the mandatory score of the whole answer.
    result = report(page(0, [region('answer'), sub, grade(scope='inciso', inciso='a')]))
    assert [i['field']['scope'] for i in result['errors']] == ['pregunta']


def test_other_students_grade_cannot_cover_this_students_response():
    result = report(page(0, [region('answer')]), page(1, [grade()], 'EX_0002'))
    assert 'missing_grade' in codes(result, 'errors')


def test_incomplete_grades_and_ambiguous_orders_are_errors():
    result = report(page(0, [region('one'), region('two'), grade(value=None)]))
    assert {'missing_grade', 'incomplete_grade', 'ambiguous_order'} <= codes(result, 'errors')


def test_shared_question_geometry_is_only_a_reviewable_warning():
    sub = region('sub', 'subpregunta', 'P2', 'a')
    sub.update(x1=150, y1=250, x2=550, y2=550)
    result = report(page(0, [region('answer'), sub, grade(), grade('p2', 'P2')]))
    assert not result['errors']
    assert 'shared_question_area' in codes(result)


def test_small_margin_fragment_and_reverse_reading_pages_are_warnings():
    tiny = region('tiny', order=2)
    tiny.update(x1=1608, y1=2268, x2=1636, y2=2339)
    first_page = page(0, [tiny, grade()])
    first_page.update(width=1654, height=2339)
    result = report(first_page, page(1, [region('first', order=1)]))
    assert not result['errors']
    assert {'reverse_pages', 'small_region'} <= codes(result)


def test_denominator_disagreement_or_unanswered_grade_does_not_invent_an_error():
    result = report(page(0, [grade()]), page(1, [grade('other', denominator=5)], 'EX_0002'))
    assert not result['errors']
    assert {'different_denominators', 'grade_without_response'} <= codes(result)


def test_gaps_and_nearly_duplicate_rectangles_are_reviewable():
    sub = region('sub', 'subpregunta', inciso='c')
    result = report(page(0, [region('first'), region('second', order=3), sub, grade()]))
    assert not result['errors']
    assert {'order_gaps', 'inciso_gaps', 'duplicate_area'} <= codes(result)


def test_fingerprint_is_semantic_and_deterministic():
    data = {'pages': [page(0, [region('first'), grade()])]}
    initial = validate_batch(data)
    reordered = deepcopy(data)
    reordered['pages'][0]['regions'].reverse()
    reordered['pages'][0]['regions'][0]['updated_at'] = 'another timestamp'
    assert validate_batch(reordered) == initial
    reordered['pages'][0]['regions'][0]['score_value'] = 1
    assert validate_batch(reordered)['fingerprint'] != initial['fingerprint']


def test_invalid_geometry_is_a_blocking_error():
    bad = region('bad')
    bad['x2'] = 1001
    assert 'invalid_box' in codes(report(page(0, [bad, grade()])), 'errors')


def test_export_service_cannot_bypass_required_grades(tmp_path):
    import pytest
    from app.services import export_zip
    answer = region('answer')
    answer['page_id'] = 'page0'
    with pytest.raises(ValueError, match='Cada respuesta'):
        export_zip({}, [page(0, [answer])], [answer], 'export', 'ocr', tmp_path/'result.zip')
