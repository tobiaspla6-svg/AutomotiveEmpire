"""Fast GLB packaging checks for Automotive Empire GT-RS CI."""
import sys,json,struct
from pathlib import Path
out=Path(sys.argv[1])
report=json.loads((out/"report.json").read_text())
src=out/"AE_GTRS_HERO.blend"
assert src.is_file() and src.stat().st_size>100000,"Editable Blender source is missing"
print("Blender source",src.stat().st_size,"bytes")
by_lod={i:int(r["triangles"]) for i,r in enumerate(report["lods"])}
assert all(k in by_lod for k in (0,1,2)),"Need all three LODs"
assert 15000<by_lod[0]<220000,"LOD0 must be detailed but browser-sized"
assert by_lod[2]<by_lod[1]<by_lod[0],f"LOD triangles not reduced: {by_lod}"
budgets=[16_000_000,12_000_000,8_000_000]
for lod in range(3):
    f=out/f"AE_GTRS_LOD{lod}.glb"
    assert f.is_file(),"Missing GLB "+str(f)
    raw=f.read_bytes()
    magic,ver,total=struct.unpack_from("<4sII",raw,0)
    assert magic==b"glTF" and ver==2 and total==len(raw),"Invalid GLB header"
    n,typ=struct.unpack_from("<I4s",raw,12)
    assert typ==b"JSON","First GLB chunk must be JSON"
    doc=json.loads(raw[20:20+n])
    names={node.get("name","") for node in doc.get("nodes",[])}
    assert any("HOOD" in name for name in names),"Missing opening-hood geometry"
    assert any(name.startswith("ENGINE_") for name in names),"Missing engine geometry"
    assert "animations" in doc and len(doc["animations"])>0,"Opening-hood animation not exported"
    assert len(raw)<budgets[lod],f"LOD{lod} too heavy: {len(raw)}"
    print(f.name,"bytes",len(raw),"triangles",by_lod[lod],"materials",len(doc.get("materials",[])),
          "meshes",len(doc.get("meshes",[])),"nodes",len(names),"animations",len(doc.get("animations",[])))
for n in ("review_front.png","review_profile.png","review_engine.png"):
    f=out/n;assert f.is_file() and f.stat().st_size>2000, "Missing review "+n
print("GT asset packaging PASS")
