"""Structured teacher scores and compatibility with existing annotations."""
import math
import re


def legacy_score(value):
    """Convert only unambiguous fractions; never guess missing denominators."""
    match = re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)\s*', value or '')
    if not match:
        return None
    score, denominator = (float(part.replace(',', '.')) for part in match.groups())
    if not math.isfinite(score) or not math.isfinite(denominator) or denominator <= 0 or score > denominator:
        return None
    return score, denominator


def grade_problem(region):
    if region['kind'] != 'calificacion':
        return None
    if region['scope'] not in ('pregunta', 'inciso') or not region['question_id']:
        return 'Asigná la calificación a una pregunta o un inciso'
    if region['scope'] == 'inciso' and not region['subquestion_id']:
        return 'Falta el inciso de la calificación'
    value, denominator = region.get('score_value'), region.get('score_denominator')
    if value is None or denominator is None:
        return 'Completá el valor y el denominador de la calificación'
    if not math.isfinite(value) or not math.isfinite(denominator) or value < 0 or denominator <= 0 or value > denominator:
        return 'La calificación debe cumplir 0 ≤ valor ≤ denominador, con denominador mayor que cero'
    return None
