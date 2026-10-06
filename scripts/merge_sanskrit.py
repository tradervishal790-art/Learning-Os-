#!/usr/bin/env python3
"""Adds Sanskrit equivalents to public/data/dictionary.json (the `sk` field).

Sources, best first (tagged in each entry as `src`):
  a  Apte, Student's English-Sanskrit Dictionary (1920) — real English->Sanskrit
     headwords, reliable, nouns/verbs/adjectives in standard use.
  m  Monier-Williams, English-Sanskrit Dictionary (1851) — wider but noisier;
     only used when Apte has no entry, and only for parts of speech the English
     word really has.
  h  Previous build: Hindi meaning matched a Sanskrit headword in the 1899
     Sanskrit-English dictionary — kept only when its gloss is short and clean.

Usage:  pip install indic-transliteration
        python scripts/merge_sanskrit.py
Then bump DICTIONARY_VERSION in src/dictionaryStore.ts (cache busting!).
Sources (Cologne Digital Sanskrit Dictionaries, via sanskrit-lexicon/csl-orig on GitHub).
"""
import json, re, collections, urllib.request, os
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT = os.path.join(ROOT, 'public/data/dictionary.json')
BASE = 'https://raw.githubusercontent.com/sanskrit-lexicon/csl-orig/master/v02/'

def get(name):
    return urllib.request.urlopen(BASE + f'{name}/{name}.txt', timeout=120).read().decode('utf-8')

def deva(slp1):
    return transliterate(slp1, sanscript.SLP1, sanscript.DEVANAGARI)

# ---------------- Apte ----------------
AE_POS = {'s.':'noun','v. t.':'verb','v. i.':'verb','a.':'adjective','adv.':'adverb',
          'prep.':'preposition','pron.':'pronoun','conj.':'conjunction','interj.':'interjection','pred.':'adjective'}

def ae_tokens(seg):
    seg = re.sub(r'\([^()]*\)', '', seg)
    out = []
    for m in re.finditer(r'<s>(.*?)</s>', seg):
        for t in m.group(1).split(','):
            t = re.sub(r'\s+\d+.*$', '', t.strip())
            if t and re.fullmatch(r'[A-Za-z]+', t):
                out.append(t)
    return out

def parse_apte(txt):
    res = {}
    for blk in re.finditer(r'<L>\d+<pc>\d+<k1>([^<]+)<k2>[^\n]*\n(.*?)<LEND>', txt, re.S):
        k1, body = blk.group(1).strip().lower(), blk.group(2)
        if not re.fullmatch(r"[a-z][a-z' -]*", k1):
            continue
        found = []
        for line in body.split('\n'):
            if line.startswith('Ⓝ'):
                break  # derived headwords (e.g. "abandoned") start here
            if not (line.startswith('{@') or line.startswith('Ⓔ')):
                continue
            for pm in re.finditer(r'<lex>([^<]+)</lex>Ⓓ([^‘Ⓑ\n]*)', line):
                pos = AE_POS.get(pm.group(1).strip())
                if pos:
                    found += [(t, pos) for t in ae_tokens(pm.group(2))[:4]]
        seen, lst = set(), []
        for t, pos in found:
            if t not in seen:
                seen.add(t)
                lst.append({'slp1': t, 'deva': deva(t), 'pos': pos})
        if lst:
            res[k1] = lst[:5]
    return res

# ---------------- Monier-Williams English-Sanskrit ----------------
MWE_POS = {'s.':'noun','a.':'adjective','v. a.':'verb','v. n.':'verb','v.':'verb',
           'adv.':'adverb','prep.':'preposition','conj.':'conjunction','interj.':'interjection','pron.':'pronoun'}

def parse_mwe(txt):
    res = {}
    for blk in re.finditer(r'<L>\d+<pc>[^<]*<k1>([^<]+)<k2>[^\n]*\n(.*?)(?=\n<L>|\Z)', txt, re.S):
        k1 = blk.group(1).strip().lower()
        if not re.fullmatch(r"[a-z][a-z' -]*", k1):
            continue
        lines = blk.group(2).split('\n')
        keep = [lines[0]]
        for ln in lines[1:]:
            if re.match(r"^[A-Z][A-Z' -]*¦", ln):
                break
            keep.append(ln)
        parts = re.split(r'(\{%(?:s|a|v\. a|v\. n|v|adv|prep|conj|interj|pron)\.[,]?%\})', ' '.join(keep))
        found, cur = [], None
        for p in parts:
            m = re.fullmatch(r'\{%([a-z. ]+?)[,]?%\}', p)
            if m and m.group(1).strip() in MWE_POS:
                cur = MWE_POS[m.group(1).strip()]
                continue
            if cur is None:
                continue
            toks = []
            for g in re.finditer(r'\{#(.*?)#\}', p, re.S):
                for t in g.group(1).replace('\n', ' ').split(','):
                    t = t.strip()
                    if t and t[0] != '-' and re.fullmatch(r'[A-Za-z]+', t):
                        toks.append(t)
                if len(toks) >= 4:
                    break
            found += [(t, cur) for t in toks[:4]]
            cur = None
        seen, lst = set(), []
        for t, pos in found:
            if t not in seen:
                seen.add(t)
                lst.append({'slp1': t, 'deva': deva(t), 'pos': pos})
        if lst:
            res[k1] = lst
    return res

# ---------------- merge ----------------
def clean_old(sk):
    out = []
    for m in sk or []:
        if m.get('src'):
            continue  # already produced by this script — only re-evaluate original matches
        meaning = (m.get('meaning') or '').strip()
        if 0 < len(meaning) <= 60 and not re.search(r'\b[A-Z][A-Za-z]*\.|&c|cf\.|\bL\.', meaning):
            out.append({'deva': m['deva'], 'slp1': m['slp1'], 'meaning': meaning, 'src': 'h'})
    return out[:2]

def main():
    print('downloading sources…')
    apte, mwe = parse_apte(get('ae')), parse_mwe(get('mwe'))
    data = json.load(open(DICT, encoding='utf-8'))
    stats = collections.Counter()
    for word, e in data.items():
        old = clean_old(e.get('sk'))
        poss = set(e.get('p') or [])
        new = None
        if word in apte:
            new = [{'deva': x['deva'], 'slp1': x['slp1'], 'meaning': x['pos'], 'src': 'a'}
                   for x in apte[word] if not poss or x['pos'] in poss][:4]
            src = 'a'
        if not new and word in mwe:
            new = [{'deva': x['deva'], 'slp1': x['slp1'], 'meaning': x['pos'], 'src': 'm'}
                   for x in mwe[word] if x['pos'] in poss][:3]
            src = 'm'
        if not new and old:
            new, src = old, 'h'
        if new:
            e['sk'] = new
            stats[src] += 1
        else:
            e.pop('sk', None)
            stats['none'] += 1
    # Inflected forms ("running", "waters") inherit their base word's Sanskrit.
    lemma_of = {}
    for word, e in data.items():
        if e.get('sk'):
            for form in e.get('f') or []:
                lemma_of.setdefault(form.strip().lower(), word)
    for word, e in data.items():
        if not e.get('sk') and word in lemma_of and word != lemma_of[word]:
            e['sk'] = data[lemma_of[word]]['sk']
            stats['inherited'] += 1
            stats['none'] -= 1
    with open(DICT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(dict(stats), 'total', len(data))

if __name__ == '__main__':
    main()
