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
    if lod==0:
        assert any("SURF_front_curved_nose" in name for name in names),"Missing resculpted front end"
        assert any("SURF_front_sculpted_fender_" in name for name in names),"Missing curved fenders"
        assert any("SURF_grille_forged_vertical_" in name for name in names),"Missing physical grille slats"
        assert any("TURBO_spiral_cast_volute_" in name for name in names),"Missing new turbocharger casting"
        assert any("TURBO_ten_blade_impeller_" in name for name in names),"Missing compressor impellers"
    assert any(name.startswith("ENGINE_") for name in names),"Missing engine geometry"
    assert "animations" in doc and len(doc["animations"])>0,"Opening-hood animation not exported"
    assert len(raw)<budgets[lod],f"LOD{lod} too heavy: {len(raw)}"
    print(f.name,"bytes",len(raw),"triangles",by_lod[lod],"materials",len(doc.get("materials",[])),
          "meshes",len(doc.get("meshes",[])),"nodes",len(names),"animations",len(doc.get("animations",[])))
# Verify independently streamable body and powertrain, with matching LOD dimensions.
for lod in range(3):
    for role in ("BODY", "ENGINE"):
        file=out/f"AE_GTRS_{role}_LOD{lod}.glb"
        assert file.is_file(), "Missing streamable asset "+str(file)
        binary=file.read_bytes()
        magic,version,total=struct.unpack_from("<4sII",binary,0)
        assert magic==b"glTF" and version==2 and total==len(binary), "Invalid split GLB"
        json_len,typ=struct.unpack_from("<I4s",binary,12)
        assert typ==b"JSON"
        desc=json.loads(binary[20:20+json_len])
        node_names={n.get("name","") for n in desc.get("nodes",[])}
        if role=="BODY":
            assert any("HOOD" in n for n in node_names), "Body missing bonnet"
            assert len(desc.get("animations",[]))>0, "Body must include articulated bonnet"
        else:
            assert any(n.startswith("ENGINE_") for n in node_names), "Engine lacks geometry"
        assert len(binary)<budgets[lod],f"Split {role} LOD{lod} too large"
        print(f"{role} LOD{lod}",len(binary),"bytes",len(node_names),"nodes")
for n in ("review_front.png","review_profile.png","review_engine.png"):
    f=out/n;assert f.is_file() and f.stat().st_size>2000, "Missing review "+n
print("GT asset packaging PASS")
