"""Trích thông số smart object + asset từ một PSD mockup (cùng kiểu layer như T-Shirt_Mockup.psd).

pip install psd-tools numpy pillow
python scripts/extract_psd.py T-Shirt_Mockup.psd public/mockup
-> public/mockup/config.json, base.png (các layer dưới group smart object), effect.png (group ngay trên)
"""
import json, sys, os
from PIL import Image
from psd_tools import PSDImage
from psd_tools.constants import Tag

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
psd = PSDImage.open(src)
W, H = psd.size

so_layer = next(l for l in psd.descendants() if l.kind == 'smartobject' and l.visible)
so_group = so_layer.parent
d = so_layer.tagged_blocks.get_data(Tag.SMART_OBJECT_LAYER_DATA1).data
size = [float(d[b'Sz  '][b'Wdth']), float(d[b'Sz  '][b'Hght'])]
q = [float(x) for x in d[b'nonAffineTransform']]
quad = [q[i:i + 2] for i in range(0, 8, 2)]
warp = d[b'warp']
if b'customEnvelopeWarp' in warp:
    mp = warp[b'customEnvelopeWarp'][b'meshPoints']
    mx, my = [float(v) for v in mp[b'Hrzn'].values], [float(v) for v in mp[b'Vrtc'].values]
else:  # không warp -> lưới mặc định, công thức suy biến thành perspective thuần
    mx = [c * size[0] / 3 for r in range(4) for c in range(4)]
    my = [r * size[1] / 3 for r in range(4) for c in range(4)]

# vùng in = mask của layer mà smart object clip vào (cùng group)
mask_bbox = None
for l in so_group:
    if l is not so_layer and l.mask is not None and not l.mask.disabled:
        mask_bbox = list(l.mask.bbox)
x0, y0, x1, y1 = mask_bbox or list(so_layer.bbox)


def flatten(layers):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for l in layers:
        if l.visible:
            img.alpha_composite(l.composite(viewport=(0, 0, W, H)).convert('RGBA'))
    return img


top = list(psd)
gi = top.index(so_group)
flatten(top[:gi]).convert('RGB').save(f'{out}/base.png')
eff = [l for l in top[gi + 1:] if l.visible]
eff_opacity = 1.0
if eff:
    g = eff[0]
    fo = g.tagged_blocks.get_data(Tag.BLEND_FILL_OPACITY) if Tag.BLEND_FILL_OPACITY in g.tagged_blocks else 255
    eff_opacity = (g.opacity / 255) * (fo / 255)
    # lấy pixel thô (Normal) của layer hiệu ứng — phép Multiply làm trong code
    raw = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for l in (g.descendants() if g.is_group() else [g]):
        if l.kind == 'pixel' and l.visible:
            raw.alpha_composite(l.topil().convert('RGBA'), dest=(max(l.left, 0), max(l.top, 0)))
    raw.save(f'{out}/effect.png')

cfg = dict(canvas=dict(width=W, height=H), smartObject=dict(width=size[0], height=size[1]),
           quad=quad, meshX=mx, meshY=my,
           printArea=dict(x=x0, y=y0, width=x1 - x0, height=y1 - y0),
           groupBlend=str(so_group.blend_mode), effectBlend=str(eff[0].blend_mode) if eff else None,
           effectOpacity=eff_opacity)
json.dump(cfg, open(f'{out}/config.json', 'w'), indent=2)
print(json.dumps({k: v for k, v in cfg.items() if k not in ('meshX', 'meshY')}, indent=2))
