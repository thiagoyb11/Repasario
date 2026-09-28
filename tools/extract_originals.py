"""Extrae preguntas de las revisiones Moodle incluidas en el material."""

from html.parser import HTMLParser
from html import unescape
from pathlib import Path
import json
import re


VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'wbr'}
BLOCK = {'p', 'div', 'pre', 'li', 'br', 'tr'}


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    def classes(self):
        return set(self.attrs.get('class', '').split())

    def find(self, cls):
        if cls in self.classes():
            return self
        for child in self.children:
            if isinstance(child, Node):
                found = child.find(cls)
                if found:
                    return found
        return None

    def all(self, cls):
        out = [self] if cls in self.classes() else []
        for child in self.children:
            if isinstance(child, Node):
                out.extend(child.all(cls))
        return out

    def text(self):
        parts = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            else:
                if child.tag == 'pre':
                    parts.append('\n```\n' + child.text().strip('\n') + '\n```\n')
                    continue
                if child.tag in BLOCK:
                    parts.append('\n')
                parts.append(child.text())
                if child.tag in BLOCK:
                    parts.append('\n')
        return ''.join(parts)


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean(value):
    value = unescape(value).replace('\xa0', ' ')
    lines = []
    in_code = False
    for line in value.splitlines():
        if line.strip() == '```':
            lines.append('```')
            in_code = not in_code
        elif in_code:
            lines.append(line.rstrip())
        else:
            normalized = ' '.join(line.split())
            if normalized:
                lines.append(normalized)
    return '\n'.join(lines).strip()


def extract(path):
    parser = Parser()
    parser.feed(path.read_text(encoding='utf-8', errors='replace'))
    rows = []
    for q in parser.root.all('que'):
        kind = q.classes()
        if 'match' in kind:
            continue
        stem = q.find('qtext')
        answer = q.find('answer')
        if not stem or not answer:
            continue
        options, correct = [], []
        for option in answer.children:
            if not isinstance(option, Node) or not ({'r0', 'r1'} & option.classes()):
                continue
            if 'truefalse' in kind:
                label = option.text()
            else:
                label_node = option.find('flex-fill')
                label = label_node.text() if label_node else option.text()
            label = clean(label)
            if not label:
                continue
            index = len(options)
            options.append(label)
            if 'correct' in option.classes():
                correct.append(index)
        if q.find('rightanswer'):
            right = clean(q.find('rightanswer').text())
            right = re.sub(r"^(?:La respuesta correcta es|Las respuestas correctas son|The correct answer is|The correct answers are)\s*[:']?\s*", '', right, flags=re.I).strip(" .'\n")
            right_parts = [p.strip(" .'\n").casefold() for p in right.split(',')] if re.search(r'^(?:Las respuestas correctas son|The correct answers are)', clean(q.find('rightanswer').text()), flags=re.I) else [right.casefold()]
            inferred = []
            for i, label in enumerate(options):
                if label.strip(" .'\n").casefold() in right_parts:
                    inferred.append(i)
            if not inferred and right.casefold() in ('true', 'false', 'verdadero', 'falso'):
                canonical = {'true': 'verdadero', 'false': 'falso'}.get(right.casefold(), right.casefold())
                inferred = [i for i, label in enumerate(options) if label.casefold() == canonical or label.casefold() == right.casefold()]
            if inferred:
                correct = inferred
        if len(options) < 2 or not correct:
            continue
        explanation = q.find('generalfeedback') or q.find('specificfeedback')
        if 'truefalse' in kind:
            options = [{'true': 'Verdadero', 'false': 'Falso'}.get(x.casefold(), x) for x in options]
        rows.append({
            'pregunta': clean(stem.text()),
            'opciones': options,
            'correctas': correct,
            'explicacion': clean(explanation.text()) if explanation else '',
            'fuente': path.name,
            'tipo_original': 'verdadero_falso' if 'truefalse' in kind else 'opcion_multiple',
        })
    return rows


def main():
    source = Path(__file__).resolve().parents[2] / 'cuestionarios-P1'
    all_rows = []
    for file in sorted(source.glob('*.html')):
        rows = extract(file)
        print(file.name, len(rows))
        all_rows.extend(rows)
    unique = {}
    for row in all_rows:
        key = re.sub(r'\s+', ' ', row['pregunta']).casefold()
        if key not in unique or (not unique[key]['explicacion'] and row['explicacion']):
            unique[key] = row
    print('Únicas:', len(unique))
    out = Path(__file__).resolve().parents[1] / 'tools' / 'originales_extraidas.json'
    out.write_text(json.dumps(list(unique.values()), ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
