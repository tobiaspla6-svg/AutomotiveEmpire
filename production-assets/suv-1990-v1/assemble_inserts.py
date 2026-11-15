"""Native SVG assembly: clip generated artwork to fixed original component openings."""
from pathlib import Path
import os,tempfile
os.environ.setdefault('MPLCONFIGDIR',str(Path(tempfile.gettempdir())/'ae-mpl-cache'))
import base64,json
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

R=Path(__file__).resolve().parent
base=Image.open(R/'sources/proposal-01.jpg')
meta=json.loads((R/'generated/manifest.json').read_text())
index={r['id']:r for r in meta['records']}
# Inset faces preserve the source perimeter, fasteners and attachment structure.
LAMP=[(203,751),(224,752),(251,753),(279,755),(296,756),(303,760),(305,775),(304,795),(300,810),(293,820),(282,826),(266,829),(245,830),(218,830),(195,828),(193,819),(194,800),(196,779),(199,761)]
BUMPER=[(146,922),(151,914),(163,909),(179,908),(197,911),(220,916),(251,920),(284,922),(312,922),(342,922),(331,954),(321,988),(312,1025),(303,1066),(297,1071),(279,1072),(248,1071),(216,1069),(192,1064),(172,1055),(158,1043),(149,1027),(144,1006),(142,981),(143,953),(142,936)]
svg_layers={};mounts={}
fig,axs=plt.subplots(2,2,figsize=(13,9),dpi=140)
for row,(part,poly,zoom) in enumerate([('headlamp',LAMP,(150,355,870,715)),('bumper-face',BUMPER,(110,380,1090,880))]):
    pts=np.array(poly);lo=pts.min(axis=0);hi=pts.max(axis=0);center=(lo+hi)/2
    for col,variant in enumerate(['a','b']):
        original=f'light-{variant}-v2-original' if part=='headlamp' else f'bumper-{variant}-v1-original'
        record=index[original];cc=max(record['components'],key=lambda c:c['area'])
        x,y,w,h=cc['bbox_xywh'];im=Image.open(R/record['path'])
        scale=(1.02 if part=='headlamp' else 1.15)*max((hi[0]-lo[0]+8)/w,(hi[1]-lo[1]+8)/h)
        pivot=[x+(w-1)/2,y+(h-1)/2];ix=center[0]-pivot[0]*scale;iy=center[1]-pivot[1]*scale
        path='M '+' L '.join(f'{a},{b}' for a,b in poly)+' Z'
        uri='data:image/png;base64,'+base64.b64encode((R/record['path']).read_bytes()).decode()
        layer=f'<defs><clipPath id="clip-{part}-{variant}"><path d="{path}"/></clipPath></defs><g clip-path="url(#clip-{part}-{variant})"><image href="{uri}" x="{ix}" y="{iy}" width="{im.width*scale}" height="{im.height*scale}"/></g>'
        key=f'{part}-{variant}'
        svg_layers[key]=layer.replace(uri,record['path'])
        (R/'layers'/f'{key}-registered.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="2752" height="1536" viewBox="0 0 2752 1536">'+layer+'</svg>',encoding='utf-8')
        mounts[key]={'source':record['path'],'uniform_scale':scale,'image_origin':[ix,iy],'clip_polygon_source_pixels':poly,
                     'part_scope':'lens interior only; original border and markers retained' if part=='headlamp' else 'bumper face only; original outline, recovery eye and mount structure retained',
                     'status':'awaiting_visual_review','raw_generator_registration':'failed; explicit source geometry mount used'}
        ax=axs[row,col];ax.imshow(base,extent=(0,2752,1536,0))
        patch=Polygon(poly,closed=True,facecolor='none',edgecolor='none');ax.add_patch(patch)
        artist=ax.imshow(im,extent=(ix,ix+im.width*scale,iy+im.height*scale,iy),interpolation='lanczos',zorder=2);artist.set_clip_path(patch)
        ax.set_xlim(zoom[0],zoom[1]);ax.set_ylim(zoom[2],zoom[3]);ax.set_aspect('equal');ax.set_title(key+' — original boundary retained')
fig.tight_layout();fig.savefig(R/'qa/inserts-mounted-review.png');plt.close(fig)
(R/'qa/insert-mounts.json').write_text(json.dumps(mounts,indent=2),encoding='utf-8')

# Local review page, no remote requests. SVG uses the exact same clip geometry.
rim=json.loads((R/'qa/sprite-mounts.json').read_text())['designs']
rim_layers={}
for design,m in rim.items():
    im=Image.open(R/m['original']);s=m['uniform_scale_to_source'];cx,cy=m['native_pivot']
    elements=[]
    for hx,hy in m['hubs']:
        elements.append(f'<image href="{m["original"]}" x="{hx-cx*s}" y="{hy-cy*s}" width="{im.width*s}" height="{im.height*s}"/>')
    rim_layers[design]=''.join(elements)
html='''<!doctype html><html lang="es"><meta charset="utf-8"><title>Automotive Empire — prueba modular SUV</title><style>body{background:#132231;color:#f2eddf;font:16px system-ui;margin:30px}main{max-width:1500px;margin:auto}button{padding:12px 20px;margin:5px;background:#f2eddf;color:#132231;border:1px solid #c6a866;border-radius:5px;cursor:pointer}.stage{background:#fff;border:1px solid #c6a866}svg{display:block;width:100%;height:auto}p{max-width:1000px;line-height:1.5}small{color:#c6a866}</style><main><h1>Automotive Empire · SUV 1990</h1><p>Prueba de montaje con el original aprobado. Los cambios afectan solo llantas, interior de ópticas y cara del paragolpes. Carrocería y neumáticos permanecen fijos.</p><div>Llantas: <button onclick="wheel('original')">Original</button><button onclick="wheel('steel')">Acero · 6 fijaciones</button><button onclick="wheel('alloy')">Aleación · 6 fijaciones</button></div><div>Ópticas: <button onclick="lamp('original')">Original</button><button onclick="lamp('a')">Halógeno A</button><button onclick="lamp('b')">Halógeno B</button></div><div>Paragolpes: <button onclick="bumper('original')">Original</button><button onclick="bumper('a')">Cara estándar</button><button onclick="bumper('b')">Cara metálica</button></div><p><small>Prototipo de composición. Máscara de pintura, recorte definitivo y desmontaje completo del paragolpes pendientes.</small></p><div class="stage"><svg viewBox="0 0 1600 700" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.402390438 -117.61752988) scale(0.5737051793)"><image href="sources/proposal-01.jpg" width="2752" height="1536"/><g id="wheels"></g><g id="lamps"></g><g id="bumpers"></g></g></svg></div><p>Comprobaciones y limitaciones: <a style="color:#c6a866" href="PRODUCTION_HANDOFF.md">Entrega para Claude Code</a></p></main><script>'''
html+='const rims='+json.dumps(rim_layers)+';const inserts='+json.dumps(svg_layers)+';'
html+="function wheel(v){document.getElementById('wheels').innerHTML=rims[v]||''}function lamp(v){document.getElementById('lamps').innerHTML=inserts['headlamp-'+v]||''}function bumper(v){document.getElementById('bumpers').innerHTML=inserts['bumper-face-'+v]||''}wheel('alloy');</script></html>"
(R/'MODULAR_PREVIEW.html').write_text(html,encoding='utf-8')
print('Wrote four registered insert layers, QA composition and local preview')
