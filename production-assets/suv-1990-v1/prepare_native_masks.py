"""SVG masks and diagnostic rendering only; original raster files stay untouched."""
from pathlib import Path
import os,tempfile,base64,json
os.environ.setdefault('MPLCONFIGDIR',str(Path(tempfile.gettempdir())/'ae-mpl-cache'))
import cv2,numpy as np
from PIL import Image
from matplotlib.path import Path as MPath
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
R=Path(__file__).resolve().parent
src=np.asarray(Image.open(R/'sources/proposal-01.jpg').convert('RGB'))
cut=Image.open(R/'generated/cutout-v1-original.png')
def uri(p):return 'data:'+('image/jpeg' if p.suffix=='.jpg' else 'image/png')+';base64,'+base64.b64encode(p.read_bytes()).decode()
source_uri=uri(R/'sources/proposal-01.jpg');cut_uri=uri(R/'generated/cutout-v1-original.png')
scale=2752/cut.width
head='<svg xmlns="http://www.w3.org/2000/svg" width="2752" height="1536" viewBox="0 0 2752 1536">'
# Convert generated RGB to white, retain actual alpha; erode one source pixel.
defs=f'<defs><filter id="white-alpha" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/><feMorphology operator="erode" radius="1"/></filter><mask id="body-alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="2752" height="1536"><image href="{cut_uri}" width="2752" height="{cut.height*scale}" filter="url(#white-alpha)"/></mask></defs>'
(R/'layers/body-source-masked.svg').write_text(head+defs+f'<image href="{source_uri}" width="2752" height="1536" mask="url(#body-alpha)"/></svg>',encoding='utf-8')
# This specific green source separates painted material from gray/black/amber parts.
matrix='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -30 30 0 0 -0.8'
windows=[[(1070,624),(1133,519),(1210,434),(1294,382),(1370,360),(1502,350),(1490,626)],[(1547,346),(1922,347),(1933,623),(1536,625)],[(1979,348),(2391,350),(2430,380),(2440,580),(2397,609),(1983,618)]]
holepath='M0,0H2752V1536H0Z '+ ' '.join('M'+' L'.join(f'{x},{y}' for x,y in poly)+'Z' for poly in windows)
matrix_gb='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 40 -40 0 -0.8'
filterdef=f'<defs><filter id="green-selection" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="{matrix}" result="rg"/><feComponentTransfer in="rg" result="rg-step"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feColorMatrix in="SourceGraphic" type="matrix" values="{matrix_gb}" result="gb"/><feComponentTransfer in="gb" result="gb-step"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feComposite in="rg-step" in2="gb-step" operator="in"/></filter><clipPath id="exclude-glass"><path d="{holepath}" clip-rule="evenodd"/></clipPath></defs>'
(R/'layers/paint-selection-source.svg').write_text(head+filterdef+'<rect width="2752" height="1536" fill="black"/>'+f'<g clip-path="url(#exclude-glass)"><image href="{source_uri}" width="2752" height="1536" filter="url(#green-selection)"/></g></svg>',encoding='utf-8')
paint=((src[:,:,1].astype(float)-src[:,:,0].astype(float))>=12)&((src[:,:,1].astype(float)-src[:,:,2].astype(float))>=9)
yy,xx=np.mgrid[:1536,:2752];coords=np.column_stack([xx.ravel(),yy.ravel()])
for poly in windows:paint[MPath(poly).contains_points(coords).reshape(paint.shape)]=False
alpha=cv2.resize(np.asarray(cut.getchannel('A')),(2752,round(cut.height*scale)),interpolation=cv2.INTER_LINEAR)[:1536]
alpha=cv2.erode(alpha,np.ones((3,3),np.uint8))
fig,axs=plt.subplots(2,2,figsize=(16,10),dpi=130)
rgba=np.dstack([src,alpha])
for ax,bg in zip(axs[0],['#f2eddf','#132231']):
 ax.set_facecolor(bg);ax.imshow(rgba);ax.set_title('Original pixels + generated alpha matte / '+bg);ax.set_xticks([]);ax.set_yticks([])
axs[1,0].imshow(paint,cmap='gray',vmin=0,vmax=1);axs[1,0].set_title('Source-registered green selection / binary diagnostic')
axs[1,1].imshow(src);blue=np.zeros((*paint.shape,4),dtype=np.float32);blue[:,:,:3]=[.08,.35,.95];blue[:,:,3]=paint*.6;axs[1,1].imshow(blue);axs[1,1].set_title('Paint-selection registration / blue diagnostic overlay')
for ax in axs.flat:ax.set_aspect('equal')
fig.tight_layout();fig.savefig(R/'qa/native-masks-review.png');plt.close(fig)
report={'body':{'path':'layers/body-source-masked.svg','source_rgb':'unchanged original JPEG pixels','alpha_from':'generated/cutout-v1-original.png','single_uniform_scale':scale,'source_pixel_erosion':1,'status':'awaiting_visual_review'},
        'paint':{'path':'layers/paint-selection-source.svg','canvas':[2752,1536],'rule':'source sRGB G-R >= 12 AND G-B >= 9 approximately, fixed exclusion polygons for glass','window_exclusions':windows,'selected_pixels':int(paint.sum()),'status':'awaiting_visual_review','limitation':'specific green source; do not rederive from recolored render or apply to another body'},
        'important':'Diagnostic plot simulates native SVG masks; browser rendering remains untested.'}
(R/'qa/native-masks.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
