"""Deterministic annotation checks. Geometry suggests review, never a new label."""
from collections import defaultdict
import hashlib
import json
import re

from .grading import covering_grades, grade_problem


def _area(r):
    return max(0, r['x2']-r['x1']) * max(0, r['y2']-r['y1'])


def _overlap(a, b):
    return max(0, min(a['x2'], b['x2'])-max(a['x1'], b['x1'])) * max(0, min(a['y2'], b['y2'])-max(a['y1'], b['y1']))


def validate_batch(batch):
    pages = sorted(batch['pages'], key=lambda p: p['page_index'])
    errors, warnings = [], []
    by_exam, groups, grade_groups = defaultdict(list), defaultdict(list), defaultdict(list)
    locations = {}
    for page in pages:
        for r in sorted(page['regions'], key=lambda r: r['id']):
            locations[r['id']] = page
            by_exam[page['exam_id']].append(r)
            if r['kind'] in ('respuesta', 'subpregunta'):
                groups[(page['exam_id'], r['question_id'], r['kind'], r['subquestion_id'] if r['kind'] == 'subpregunta' else None)].append(r)
            if r['kind'] == 'calificacion' and not grade_problem(r):
                grade_groups[(r['question_id'], r['scope'], r['subquestion_id'] if r['scope'] == 'inciso' else None)].append(r)

    def add(target, code, message, regions, field=None):
        regions = sorted(regions, key=lambda r: (locations[r['id']]['page_index'], r['id']))
        issue = {'code': code, 'message': message, 'page_index': locations[regions[0]['id']]['page_index'],
                 'region_ids': [r['id'] for r in regions], 'field': field}
        target.append(issue)

    for page in pages:
        for r in sorted(page['regions'], key=lambda r: r['id']):
            problem = grade_problem(r)
            if problem:
                add(errors, 'incomplete_grade', problem, [r])
            if _area(r) <= 0 or min(r['x1'], r['y1']) < 0 or r['x2'] > page['width'] or r['y2'] > page['height']:
                add(errors, 'invalid_box', 'La región queda fuera de la página o no tiene área.', [r])
            elif r['kind'] != 'privacidad' and min(r['x2']-r['x1'], r['y2']-r['y1']) < max(12, .02*min(page['width'], page['height'])):
                add(warnings, 'small_region', 'Recorte muy estrecho o pequeño: verificá que incluya todo el contenido.', [r])

    for key, members in sorted(groups.items()):
        exam, question, kind, inciso = key
        field = {'exam_id': exam, 'question_id': question, 'scope': 'pregunta' if kind == 'respuesta' else 'inciso', 'subquestion_id': inciso}
        label = f'{exam} · {question}' + (f'.{inciso}' if inciso else '')
        if not covering_grades(by_exam[exam], members[0]) and not (kind == 'subpregunta' and (exam, question, 'respuesta', None) in groups):
            add(errors, 'missing_grade', f'{label}: falta una calificación completa para esta respuesta.', members, field)
        orders = [r['reading_order'] for r in members]
        if any(not isinstance(n, int) or n < 1 for n in orders) or len(set(orders)) != len(orders):
            add(errors, 'ambiguous_order', f'{label}: el orden de fragmentos es inválido o está repetido.', members)
        else:
            if sorted(orders) != list(range(1, len(orders)+1)):
                add(warnings, 'order_gaps', f'{label}: hay saltos en el orden de fragmentos; verificá que no falte alguno.', members)
            ordered = sorted(members, key=lambda r: r['reading_order'])
            if any(locations[a['id']]['page_index'] > locations[b['id']]['page_index'] for a,b in zip(ordered, ordered[1:])):
                add(warnings, 'reverse_pages', f'{label}: la lectura vuelve a una página anterior. Puede ser intencional.', members)

    incisos = defaultdict(list)
    for (exam, question, kind, inciso), members in groups.items():
        if kind == 'subpregunta' and inciso and re.fullmatch('[a-z]+', inciso):
            incisos[(exam, question)].extend(members)
    for (exam, question), members in sorted(incisos.items()):
        labels = {r['subquestion_id'] for r in members}
        numbers = set()
        for label in labels:
            n = 0
            for char in label:
                n = n*26 + ord(char)-96
            numbers.add(n)
        if len(numbers) != max(numbers):
            add(warnings, 'inciso_gaps', f'{exam} · {question}: hay saltos en los incisos o no comienzan en a. Puede haber incisos sin responder.', members)

    # Shared content across questions is allowed: only suggest reviewing that mapping.
    for page in pages:
        answers = [r for r in page['regions'] if r['kind'] == 'respuesta']
        for r in sorted(page['regions'], key=lambda r: r['id']):
            if r['kind'] != 'subpregunta' or _area(r) == 0:
                continue
            own = max([_overlap(r,a)/_area(r) for a in answers if a['question_id'] == r['question_id']] or [0])
            other = [a for a in answers if a['question_id'] != r['question_id'] and _overlap(r,a)/_area(r) >= .8]
            if own < .8 and other:
                add(warnings, 'shared_question_area', 'El inciso ocupa la zona de otra pregunta. Confirmá si el docente admite una respuesta compartida.', [r, *other])

        academic = sorted([r for r in page['regions'] if r['kind'] in ('respuesta', 'subpregunta')], key=lambda r: r['id'])
        for index, a in enumerate(academic):
            for b in academic[index+1:]:
                if a['kind'] != b['kind']:
                    continue
                union = _area(a)+_area(b)-_overlap(a,b)
                if union and _overlap(a,b)/union >= .95:
                    add(warnings, 'duplicate_area', 'Dos campos tienen casi el mismo recorte. Revisá si es una repetición o contenido compartido intencional.', [a,b])

    for key, members in sorted(grade_groups.items()):
        if len({r['score_denominator'] for r in members}) > 1:
            add(warnings, 'different_denominators', f'{key[0]}: hay denominadores diferentes para el mismo campo. Verificá el criterio docente.', members)
        per_exam = defaultdict(list)
        for r in members:
            per_exam[locations[r['id']]['exam_id']].append(r)
        for exam, scores in sorted(per_exam.items()):
            if len({(r['score_value'], r['score_denominator']) for r in scores}) > 1:
                add(warnings, 'different_scores', f'{exam} · {key[0]}: hay notas distintas para el mismo campo; puede haber una corrección docente.', scores)
            sample = scores[0]
            if not any(k[0] == exam and k[1] == sample['question_id'] and
                       (sample['scope'] == 'pregunta' or k[2] == 'subpregunta' and k[3] == sample['subquestion_id']) for k in groups):
                add(warnings, 'grade_without_response', f'{exam} · {key[0]}: hay una nota sin respuesta marcada. Puede estar sin responder.', scores)

    # Acknowledgments apply to this exact semantic snapshot, excluding save timestamps.
    snapshot = [{k: p[k] for k in ('id', 'page_index', 'width', 'height', 'rotation', 'is_exam_start')} |
                {'regions': [{k:v for k,v in r.items() if k != 'updated_at'} for r in sorted(p['regions'], key=lambda r:r['id'])]}
                for p in pages]
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    return {'errors': errors, 'warnings': warnings, 'fingerprint': fingerprint}
