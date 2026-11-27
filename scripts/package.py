"""Package an unpacked extension. Run from any directory with Python 3.8+."""
import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path, nargs="?", default=root / "dist" / "marginmate.zip")
output = parser.parse_args().output
output.parent.mkdir(parents=True, exist_ok=True)
files = {p.relative_to(root / "extension").as_posix(): p for p in (root / "extension").rglob("*") if p.is_file()}
files["LICENSE"] = root / "LICENSE"
with ZipFile(output, "w") as archive:
    for name, source in sorted(files.items()):
        entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, source.read_bytes(), compress_type=ZIP_DEFLATED)
print(output)
