"""Reubica notas editoriales mal pegadas al final del artículo N.

En el PDF la nota queda entre N y N+1; el extractor la dejó en N.
Van al artículo de abajo (N+1), salvo cuando la nota habla del artículo actual.

Quedan en el campo opcional nota_editorial (no mezcladas con el texto legal).
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "articulos.json"

NOTE_AT_END = re.compile(
    r"^(?P<body>.*?)(?P<note>\s*Nota editorial(?:\s*\([^)]*\))?:\s*.+)$",
    re.IGNORECASE | re.DOTALL,
)

KEEP_RE = re.compile(
    r"este\s+art[íi]culo"
    r"|se\s+adiciona\s+este\s+art[íi]culo"
    r"|se\s+incorpora\s+este\s+art[íi]culo"
    r"|fracci[oó]n\s+.+\s+de\s+este\s+art[íi]culo"
    r"|art[íi]culo\s+anterior"
    r"|se\s+reform[oó]"
    r"|se\s+flexibiliza\s+la\s+fracci[oó]n"
    r"|se\s+precis[ao]\s+la\s+fracci[oó]n"
    r"|se\s+elimin[oó]\s+la\s+cita"
    r"|la\s+remisi[oó]n\s+original"
    r"|la\s+cita\s+al",
    re.IGNORECASE,
)

INCORPORA_NUM_RE = re.compile(
    r"se\s+incorporan?\s+el\s+art[íi]culo\s+(\d+)"
    r"|se\s+incorporan?\s+los\s+art[íi]culos?\s+(\d+)\s*a\s*(\d+)"
    r"|se\s+incorporan?\s+los\s+art[íi]culos?\s+(\d+)\s*y\s*(\d+)",
    re.IGNORECASE,
)

MOVE_RE = re.compile(
    r"art[íi]culo\s+siguiente"
    r"|art[íi]culos\s+siguientes"
    r"|art[íi]culo\s+nuevo"
    r"|art[íi]culos\s+nuevos"
    r"|los\s+siguientes\s+art[íi]culos\s+se\s+adicionan"
    r"|se\s+incorpora\s+un\s+nuevo\s+[Cc]ap[íi]tulo"
    r"|se\s+incorporan\s+dos\s+art[íi]culos\s+nuevos"
    r"|se\s+incorporan\s+los\s+art[íi]culos\s+siguientes",
    re.IGNORECASE,
)

SELF_RE = re.compile(
    r"este\s+art[íi]culo|se\s+adiciona\s+este|se\s+incorpora\s+este",
    re.IGNORECASE,
)


def art_sort_key(a: dict) -> tuple:
    s = str(a["articulo"])
    m = re.match(r"^(\d+)", s)
    return (int(m.group(1)) if m else 99999, s)


def should_keep_on_current(note: str, art_num: str) -> bool:
    if SELF_RE.search(note):
        return True
    if KEEP_RE.search(note) and not MOVE_RE.search(note):
        return True
    if MOVE_RE.search(note) and not SELF_RE.search(note):
        return False

    for m in INCORPORA_NUM_RE.finditer(note):
        nums = [x for x in m.groups() if x]
        if len(nums) == 1 and nums[0] == art_num:
            return True
        if len(nums) >= 2:
            try:
                lo, hi = int(nums[0]), int(nums[-1])
                if lo <= int(art_num) <= hi:
                    return True
            except ValueError:
                pass
        if art_num in nums:
            return True

    # Por defecto: artículo debajo de la nota
    return False


def assign_nota(art: dict, note: str) -> None:
    prev = (art.get("nota_editorial") or "").strip()
    if prev:
        if note in prev:
            return
        art["nota_editorial"] = prev + " " + note
    else:
        art["nota_editorial"] = note


def main() -> None:
    arts: list[dict] = json.loads(JSON_PATH.read_text(encoding="utf-8"))

    by_idx: dict[str, list[int]] = defaultdict(list)
    for i, a in enumerate(arts):
        by_idx[a["doc"]].append(i)

    moved = kept = skipped = 0
    log_moved: list[str] = []

    for doc, indices in by_idx.items():
        indices = sorted(indices, key=lambda i: art_sort_key(arts[i]))
        for pos, ii in enumerate(indices):
            a = arts[ii]
            texto = a.get("texto") or ""
            if "Nota editorial" not in texto:
                continue
            m = NOTE_AT_END.match(texto)
            if not m:
                skipped += 1
                continue
            body = m.group("body").rstrip()
            note = m.group("note").strip()
            if not body or "Nota editorial" in body:
                skipped += 1
                continue

            art_num = str(a["articulo"])
            a["texto"] = body

            if should_keep_on_current(note, art_num):
                assign_nota(a, note)
                kept += 1
                continue

            if pos + 1 >= len(indices):
                # Sin siguiente: la dejamos en el actual
                assign_nota(a, note)
                skipped += 1
                continue

            nxt = arts[indices[pos + 1]]
            assign_nota(nxt, note)
            moved += 1
            log_moved.append(f"{doc} {art_num} -> {nxt['articulo']}")

    JSON_PATH.write_text(
        json.dumps(arts, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"moved={moved} kept_on_current={kept} skipped={skipped}")
    for line in log_moved:
        print(" ", line)

    for a in arts:
        if a["doc"] == "servicios" and a["articulo"] in ("4", "5"):
            print(f"\nSERV {a['articulo']} nota={a.get('nota_editorial', '')[:100]!r}")
            print(f"  texto={a['texto'][:120]!r}")


if __name__ == "__main__":
    main()
