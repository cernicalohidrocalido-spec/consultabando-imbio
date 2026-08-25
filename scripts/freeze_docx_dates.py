# -*- coding: utf-8 -*-
"""Copia cada DOCX a temp/ congela campos DATE (deja el valor cacheado) y deja listos los archivos."""
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "docx"
TEMP = ROOT / "scripts" / "_docx_freeze_tmp"


def freeze_date_in_xml(xml: str) -> tuple[str, int]:
    """Convierte campos DATE en QUOTE con el valor ya cacheado (no cambia al abrir)."""
    pattern = re.compile(
        r"(<w:instrText[^>]*>)\s*DATE\b[^<]*(</w:instrText>)"
        r"(.*?<w:t[^>]*>)([^<]*)(</w:t>)",
        re.I | re.S,
    )
    n = 0

    def repl(m: re.Match) -> str:
        nonlocal n
        n += 1
        val = m.group(4).strip() or "—"
        safe = val.replace('"', "'")
        return (
            f'{m.group(1)} QUOTE "{safe}" \\* MERGEFORMAT {m.group(2)}'
            f"{m.group(3)}{val}{m.group(5)}"
        )

    new_xml = pattern.sub(repl, xml)
    return new_xml, n


def process_docx(src: Path, dest: Path) -> int:
    frozen_total = 0
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src, "r") as zin, zipfile.ZipFile(
        dest, "w", compression=zipfile.ZIP_DEFLATED
    ) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            name = info.filename
            if name.startswith("word/header") or name.startswith("word/footer"):
                if name.endswith(".xml"):
                    xml = data.decode("utf-8")
                    xml2, n = freeze_date_in_xml(xml)
                    frozen_total += n
                    data = xml2.encode("utf-8")
            zout.writestr(info, data)
    return frozen_total


def main():
    if TEMP.exists():
        shutil.rmtree(TEMP)
    TEMP.mkdir(parents=True)
    for src in sorted(DOCX.glob("*.docx")):
        dest = TEMP / src.name
        n = process_docx(src, dest)
        print(f"{src.name}: DATE congelados={n}")


if __name__ == "__main__":
    main()
