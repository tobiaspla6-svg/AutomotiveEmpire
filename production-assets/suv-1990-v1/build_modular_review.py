"""Assemble SVG image layers and reproducible QA plots; never redraw source pixels."""
from pathlib import Path
import os, tempfile
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir())/'ae-mpl-cache'))
import base64, hashlib, json, shutil
import cv2, numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent
GEN=Path('C:/Users/matia/.codex/generated_images/01a1dd27-8344-7213-885f-552290695ed4')
for name, f in {'steel-v2-original':'exec-45a69bc3-bdf1-410b-a977-73af2f10f3e7.png','alloy-v2-original':'exec-31818df4-a4b5-43e4-ad7f-40dde03f89a3.png'}.items():
    shutil.copyfile(GEN/f,ROOT/'generated'/f'{name}.png')
OUT=ROOT/'layers'; OUT.mkdir(exist_ok=True)
QA=ROOT/'qa'
BASE=Image.open(ROOT/'sources/proposal-01.jpg')
HUBS=[(566,1115),(2094,1115)]
RADIUS=134
records=[]; components={}
for p in sorted((ROOT/'generated').glob('*.png')):
    im=Image.open(p); arr=np.asarray(im)
    alpha=np.asarray(im.getchannel('A')) if 'A' in im.getbands() else None
    rec={'id':p.stem,'path':str(p.relative_to(ROOT)).replace('\\','/'),'dimensions':list(im.size),'format':im.format,'mode':im.mode,
         'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'status':'pending_correction',
         'provider':'ChatGPT built-in image_gen; not Flow or Higgsfield'}
    if alpha is not None:
        n,labels,stats,cent=cv2.connectedComponentsWithStats((alpha>128).astype(np.uint8))
        cc=[{'bbox_xywh':s[:4].tolist(),'area':int(s[4]),'alpha_centroid':c.tolist()} for s,c in zip(stats[1:],cent[1:]) if s[4]>100]
        rec.update({'has_real_alpha':bool(alpha.min()==0 and alpha.max()==255),'transparent_pixels':int((alpha==0).sum()),'components':cc})
        components[p.stem]=cc
    if p.stem.startswith('paint-mask'):
        gray=np.asarray(im.convert('L')); rec['gray_values_count']=int(len(np.unique(gray)))
        rec['exact_binary']=bool(np.isin(gray,[0,255]).all())
        rec['issue']='Generated mask contains intermediate values and needs exact contour registration; do not use as final paint mask.'
    records.append(rec)

mounts={}
fig,axes=plt.subplots(2,2,figsize=(16,10),dpi=130)
for row,design in enumerate(['steel','alloy']):
    name=f'{design}-v2-original'; p=ROOT/'generated'/f'{name}.png'; im=Image.open(p)
    x,y,w,h=components[name][0]['bbox_xywh']; cx=x+(w-1)/2;cy=y+(h-1)/2
    # Uniform fit, never anisotropic deformation. Native original remains untouched.
    scale=2*RADIUS/max(w,h)
    mounts[design]={'original':f'generated/{name}.png','native_bbox':[x,y,w,h],'native_pivot':[cx,cy],
                    'uniform_scale_to_source':scale,'target_radius':RADIUS,'hubs':HUBS,
                    'external_aspect_ratio':w/h,'note':'Explicit sprite mounting, not a claim of generator pixel registration. Same native sprite and scale reused at both hubs.'}
    uri='data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
    elements=[]
    for i,(hx,hy) in enumerate(HUBS):
        ix=hx-cx*scale; iy=hy-cy*scale
        elements.append(f'<use href="#rim-{design}" x="{ix:.8f}" y="{iy:.8f}"/>')
    definition=f'<defs><image id="rim-{design}" href="{uri}" width="{im.width*scale:.8f}" height="{im.height*scale:.8f}"/></defs>'
    svg='<svg xmlns="http://www.w3.org/2000/svg" width="2752" height="1536" viewBox="0 0 2752 1536">'+definition+''.join(elements)+'</svg>'
    (OUT/f'rims-{design}-registered.svg').write_text(svg,encoding='utf-8')
    for col,ax in enumerate(axes[row]):
        ax.imshow(BASE,extent=(0,2752,1536,0))
        for hx,hy in HUBS:
            ix=hx-cx*scale;iy=hy-cy*scale
            ax.imshow(im,extent=(ix,ix+im.width*scale,iy+im.height*scale,iy),interpolation='lanczos')
        if col==0: ax.set_xlim(0,2752);ax.set_ylim(1536,0)
        else: ax.set_xlim(335,795);ax.set_ylim(1350,880)
        ax.set_aspect('equal');ax.set_title(f'{design} — actual alpha assembly'+(' / hub detail' if col else ''))
fig.suptitle('Same original SUV, tire positions and body pixels — SVG mounting with uniform scale')
fig.tight_layout();fig.savefig(QA/'rims-v2-mounted-review.png');plt.close(fig)

# Raw full-frame overlay checks: only shared canvas normalization; no local fitting.
names=['alloy-v1-original','steel-v1-original','light-a-v1-original','light-b-v1-original','bumper-a-v1-original','bumper-b-v1-original']
fig,axs=plt.subplots(3,2,figsize=(15,13),dpi=120)
for name,ax in zip(names,axs.flat):
    im=Image.open(ROOT/'generated'/f'{name}.png');s=2752/im.width
    ax.imshow(BASE,extent=(0,2752,1536,0));ax.imshow(im,extent=(0,im.width*s,im.height*s,0),interpolation='nearest')
    if 'light' in name: ax.set_xlim(140,900);ax.set_ylim(960,680)
    elif 'bumper' in name: ax.set_xlim(80,430);ax.set_ylim(1140,850)
    else: ax.set_xlim(330,810);ax.set_ylim(1360,870)
    ax.set_title(name+' / UNCORRECTED overlay');ax.set_aspect('equal')
fig.tight_layout();fig.savefig(QA/'raw-components-fit-review.png');plt.close(fig)

cut=Image.open(ROOT/'generated/cutout-v1-original.png'); mask=Image.open(ROOT/'generated/paint-mask-v1-original.png')
fig,axs=plt.subplots(2,2,figsize=(16,10),dpi=120)
for ax,bg in zip(axs[0],['#f1ede3','#142434']):
    ax.set_facecolor(bg);ax.imshow(cut);ax.set_title('Generated cutout on '+bg)
    ax.set_xticks([]);ax.set_yticks([])
s=2752/mask.width
axs[1,0].imshow(BASE,extent=(0,2752,1536,0));axs[1,0].imshow(mask,extent=(0,mask.width*s,mask.height*s,0),alpha=.35)
axs[1,0].set_title('Paint mask overlay — contour review required')
s=2752/cut.width
axs[1,1].imshow(BASE,extent=(0,2752,1536,0));axs[1,1].imshow(cut,extent=(0,cut.width*s,cut.height*s,0),alpha=.5)
axs[1,1].set_title('Original vs generated cutout — not a lossless extraction')
for ax in axs.flat:ax.set_aspect('equal')
fig.tight_layout();fig.savefig(QA/'cutout-mask-review.png');plt.close(fig)

(QA/'sprite-mounts.json').write_text(json.dumps({'coordinate_system':'source pixels, origin top-left','source_size':[2752,1536],
    'source':'sources/proposal-01.jpg','mount_status':'awaiting_visual_review','designs':mounts},indent=2),encoding='utf-8')
(ROOT/'generated/manifest.json').write_text(json.dumps({'images_generated':len(records),'records':records},indent=2),encoding='utf-8')
print(json.dumps({'images':len(records),'mounts':mounts,'records':[{k:v for k,v in r.items() if k not in ['components','sha256']} for r in records]},indent=2))
