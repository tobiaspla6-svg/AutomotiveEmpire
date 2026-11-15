"""Source analysis and diagnostic plot only. Does not generate or edit vehicle assets."""
from pathlib import Path
import hashlib
import json
import cv2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'sources/proposal-01.jpg'
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)
rgb = Image.open(SOURCE).convert('RGB')
gray = cv2.cvtColor(cv2.imread(str(SOURCE)), cv2.COLOR_BGR2GRAY)
measurements = {}
for name, (x0, y0, x1, y1) in {
    'front': (340, 890, 800, 1345), 'rear': (1860, 890, 2330, 1345)
}.items():
    roi = cv2.GaussianBlur(gray[y0:y1, x0:x1], (5, 5), 1)
    c = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1, minDist=120,
                        param1=100, param2=45, minRadius=205, maxRadius=235)
    if c is None:
        raise RuntimeError(f'No tire circle found: {name}')
    x, y, r = c[0][0]
    measurements[name] = {'center': [round(float(x+x0), 2), round(float(y+y0), 2)],
                          'radius': round(float(r), 2), 'method': 'Hough outer tire circle estimate'}

# Shared coordinate contract proposal; requires review after actual alpha extraction.
scale = 1440 / 2510
tx = 80 - 137 * scale
ty = 650 - 1338 * scale
rois = {'headlamp': [182, 739, 321, 851],
        'fender_marker': [817, 732, 868, 768],
        'lower_front_marker': [180, 851, 234, 906],
        'front_bumper': [131, 897, 363, 1081]}
data = {
    'family_id': 'suv90-green', 'anchor_version': 'suv90-source-draft-1',
    'status': 'provisional_measurements_not_runtime_approved',
    'source': '../sources/proposal-01.jpg', 'source_canvas': list(rgb.size),
    'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'coordinate_system': 'pixels, origin top-left, x right, y down; vehicle faces left',
    'tires': measurements, 'measurement_tolerance_px': 5,
    'component_search_regions_xyxy': rois,
    'region_status': 'manual visual search boxes; NOT alpha contours or approved mount edges',
    'ground_y_estimate': 1338,
    'target_canvas_proposal': [1600, 700],
    'uniform_transform_proposal': {'scale': scale, 'translate_x': tx, 'translate_y': ty,
                                    'formula': 'target = source * scale + translation',
                                    'status': 'not_applied_no_production_master_exported'},
    'mount_points': {'headlamp': None, 'front_bumper': None},
    'rim_swap_radius': None,
    'assembly_verification': 'not_run_no_variant_files_exist',
    'warning': 'Do not align variants independently to conceal generator drift. Never stretch or recenter separate parts.'
}
(QA / 'anchors.provisional.json').write_text(json.dumps(data, indent=2), encoding='utf-8')

fig, ax = plt.subplots(figsize=(16, 9), dpi=120)
ax.imshow(rgb)
for name, m in measurements.items():
    x, y = m['center']
    ax.add_patch(Circle((x, y), m['radius'], fill=False, color='#ffbe32', lw=1.5))
    ax.plot(x, y, '+', color='#d71359', ms=14, mew=2)
    ax.text(x, y-270, f'{name}: ({x:.1f}, {y:.1f}), r~{m["radius"]:.1f}',
            ha='center', fontsize=9, bbox=dict(facecolor='white', alpha=.9))
for name, (x0, y0, x1, y1) in rois.items():
    ax.add_patch(Rectangle((x0, y0), x1-x0, y1-y0, fill=False, edgecolor='#008bba', lw=1))
    ax.text(x1+12, y0, name, color='#00749b', fontsize=7,
            bbox=dict(facecolor='white', alpha=.8))
ax.axhline(1338, color='#c32651', linestyle='--', lw=1)
ax.set_title('SOURCE MEASUREMENTS ONLY — provisional anchors; no modular assembly verified')
ax.set_xlabel('Source x (px)'); ax.set_ylabel('Source y (px)')
fig.tight_layout()
fig.savefig(QA / 'source-coordinate-review.png')
plt.close(fig)

verification = {'sources': [], 'modular_composite': 'not_run', 'variants_found': 0,
                'production_master': 'not_exported', 'new_flow_images_generated_by_agent': 0}
meta = json.loads((ROOT / 'review-metadata.json').read_text(encoding='utf-8'))
for item in meta['files']:
    p = ROOT / item['path']
    with Image.open(p) as im:
        assert list(im.size) == item['size']
        assert hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256']
        verification['sources'].append({'path': item['path'], 'hash_matches': True,
                                       'dimensions_match': True, 'has_alpha': 'A' in im.getbands()})
(QA / 'verification.json').write_text(json.dumps(verification, indent=2), encoding='utf-8')
print(json.dumps({'measurements': measurements, 'verification': verification}, indent=2))
