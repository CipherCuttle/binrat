#!/usr/bin/env python3
"""G0: owner-source image derivatives ONLY. Not a visual sign-off or production release.

Never regenerate the canonical rat. Only its original RGB pixels survive masking.
The flattened PNGs do not disclose art behind the portal strip or subject.
"""
from pathlib import Path
import hashlib, json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/design/north-star"
OUT = ROOT / "web-v2/public/north-star-g0"
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED = {
    "binrat-character-master.png": "db53e725e52f871f6eb2eb185a8dfef17425b3d9",
    "binrat-world-background.png": "42557b90197f924c5b34bb44204c6d7bdbc6c832",
    "binrat-home-north-star.png": "8cf7c81cc6b6d82e8ef61d3280f53b856e6c7243",
}
for filename, expected in EXPECTED.items():
    raw = (SOURCE / filename).read_bytes()
    got = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    if got != expected:
        raise SystemExit(f"AUTHORITY_MISMATCH {filename} expected={expected} got={got}")

master = Image.open(SOURCE / "binrat-character-master.png").convert("RGBA")
world = Image.open(SOURCE / "binrat-world-background.png").convert("RGBA")
home = Image.open(SOURCE / "binrat-home-north-star.png").convert("RGBA")
master_poly = [
    (0,12),(44,25),(120,44),(200,64),(290,87),(405,115),(505,140),
    (624,167),(714,201),(808,262),(812,285),(799,324),(818,327),
    (844,327),(879,332),(897,340),(916,363),(921,399),(911,429),
    (894,459),(881,473),(907,482),(930,492),(940,505),(936,548),
    (931,582),(941,588),(961,594),(975,609),(982,627),(974,661),
    (978,691),(966,732),(970,748),(987,755),(1040,772),
    (1109,803),(1199,838),(1200,854),(1185,892),(1182,918),
    (1172,945),(1171,1025),(1161,1072),(1155,1160),(1154,1253),(0,1253),
]
home_poly = [
    (743,266),(772,258),(790,257),(813,260),(839,277),
    (861,273),(888,267),(914,263),(936,259),(958,250),(978,227),
    (988,205),(1000,184),(1000,165),(1005,141),(1019,110),
    (1035,98),(1055,90),(1073,91),(1091,96),(1109,114),(1132,117),
    (1159,115),(1186,124),(1200,142),(1213,151),(1240,142),
    (1260,141),(1283,149),(1304,165),(1320,184),(1328,203),
    (1326,228),(1315,246),(1327,262),(1344,268),(1361,264),
    (1380,267),(1389,287),(1387,313),(1374,340),(1425,346),
    (1486,355),(1488,382),(1521,389),(1547,411),(1559,433),
    (1560,451),(1557,459),(1573,474),(1579,490),(1590,512),
    (1617,541),(1618,558),(1610,573),(718,573),(719,531),
    (727,511),(728,490),(733,464),(729,451),(737,431),
    (730,415),(733,398),(730,378),(739,365),(744,337),
    (740,322),(742,299),
]
home_tail = [
    (912,266),(918,251),(915,239),(906,230),(889,225),
    (871,216),(860,204),(858,193),(865,181),(877,170),
    (891,161),(910,154),(929,151),(947,157),(966,165),
    (981,182),(994,199),(996,217),(995,237),(990,253),
]
def extract(source, points, name, tail=None):
    rgba = np.array(source)
    height, width = rgba.shape[:2]
    seed = np.zeros((height,width), np.uint8)
    cv2.fillPoly(seed, [np.array(points,np.int32)], 1)
    if tail:
        cv2.polylines(seed,[np.array(tail,np.int32)],False,1,thickness=20,lineType=cv2.LINE_AA)
    inner = cv2.erode(seed, np.ones((17,17),np.uint8), iterations=1)
    outer = cv2.dilate(seed, np.ones((17,17),np.uint8), iterations=1)
    mask = np.full((height,width), cv2.GC_BGD, np.uint8)
    mask[outer>0] = cv2.GC_PR_BGD
    mask[seed>0] = cv2.GC_PR_FGD
    mask[inner>0] = cv2.GC_FGD
    bg = np.zeros((1,65),np.float64)
    fg = np.zeros((1,65),np.float64)
    cv2.grabCut(rgba[:,:,:3].copy(),mask,None,bg,fg,5,cv2.GC_INIT_WITH_MASK)
    matte = np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD),255,0).astype(np.uint8)
    matte = cv2.morphologyEx(matte,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    matte = np.array(Image.fromarray(matte).filter(ImageFilter.GaussianBlur(0.35)))
    rgba[:,:,3] = matte
    cut = Image.fromarray(rgba,"RGBA")
    bounds = cut.getbbox()
    if not bounds:
        raise SystemExit("EMPTY_MASK " + name)
    cut = cut.crop(bounds)
    cut.save(OUT / (name+".png"), optimize=True)
    cut.save(OUT / (name+".webp"),"WEBP",lossless=True,method=6)
    Image.fromarray(matte,"L").crop(bounds).save(OUT/(name+"-alpha.png"),optimize=True)
    return cut,bounds

master_fg, master_bbox = extract(master,master_poly,"canonical-rat-dumpster")
home_fg, home_bbox = extract(home,home_poly,"home-visible-rat-dumpster",home_tail)
for width in (500,780):
    resized = home_fg.copy()
    resized.thumbnail((width,width),Image.Resampling.LANCZOS)
    resized.save(OUT / f"home-visible-rat-dumpster-{width}w.webp","WEBP",lossless=True,method=6)

# One source sunset, with deliberate portrait crop and no second baked-in sunset.
world.convert("RGB").crop((0,0,1920,960)).resize((1536,768),Image.Resampling.LANCZOS).save(
    OUT/"world-desktop-1536.webp","WEBP",lossless=True,method=6)
world.convert("RGB").crop((575,0,1355,1080)).resize((585,810),Image.Resampling.LANCZOS).save(
    OUT/"world-phone-585x810.webp","WEBP",lossless=True,method=6)

# First-view skyline is copied from the exact approved HOME; pixels behind subject or portal rail
# cannot be recovered and must never be presented as recovered source art.
city = home.crop((0,430,720,576))
roof=[(0,68),(28,67),(32,22),(58,20),(60,45),(78,48),
 (79,73),(110,72),(115,83),(149,85),(162,61),(190,61),
 (190,70),(220,65),(230,43),(239,42),(240,58),(263,66),
 (286,59),(291,70),(320,78),(341,76),(349,62),
 (367,59),(388,48),(409,49),(409,65),(434,64),
 (446,73),(476,70),(479,35),(491,35),(491,53),
 (526,61),(547,76),(560,72),(572,65),(583,64),
 (594,39),(603,40),(612,23),(621,21),(621,60),
 (655,57),(655,71),(685,72),(719,81)]
cm = Image.new("L",city.size,0)
ImageDraw.Draw(cm).polygon(roof+[(719,145),(0,145)],fill=255)
city.putalpha(cm)
city.save(OUT/"home-city-skyline.png",optimize=True)

# Approved homepage pixel illustrations, cropped independently; all decorative, not live data.
# Radar marker pixels are inpainted, Watch fake event text removed.
panels = {
 "radar":(65,647,331,769),"replay":(435,702,547,770),
 "ledger":(706,653,849,772),"creator":(1011,647,1126,770),
 "watch":(1313,647,1598,774),
}
sizes={"radar":(515,224),"replay":(350,213),"ledger":(285,224),
       "creator":(218,220),"watch":(515,224)}
for name,coords in panels.items():
    graphic=home.crop(coords).convert("RGBA")
    if name=="radar":
        rgb=np.array(graphic.convert("RGB"))
        hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
        fake_markers=cv2.inRange(hsv,(5,90,105),(40,255,255))
        fake_markers=cv2.dilate(fake_markers,np.ones((5,5),np.uint8),iterations=2)
        graphic=Image.fromarray(cv2.inpaint(rgb,fake_markers,4,cv2.INPAINT_TELEA)).convert("RGBA")
    if name=="watch":
        # This is an empty frame; all authored mock events and timestamps are discarded.
        graphic=Image.new("RGBA",(515,224),(16,22,40,255))
    else:
        graphic=graphic.resize(sizes[name],
              Image.Resampling.LANCZOS if name=="radar" else Image.Resampling.NEAREST)
    canvas=Image.new("RGBA",(600,270),(14,19,35,255))
    pen=ImageDraw.Draw(canvas)
    pen.rectangle((8,8,591,261),outline=(71,86,108),width=2)
    pen.rectangle((16,16,583,253),outline=(34,45,66),width=1)
    canvas.alpha_composite(graphic,((600-graphic.width)//2,(270-graphic.height)//2))
    if name=="watch":
        for index,color in enumerate(((244,64,78),(255,153,35),(255,197,81),(48,194,99))):
            y=37+index*50
            pen.ellipse((90,y,104,y+14),fill=color)
            pen.line((120,y+7,470,y+7),fill=(70,84,103),width=2)
    canvas.save(OUT/f"portal-{name}-empty.png",optimize=True)
    canvas.save(OUT/f"portal-{name}-empty.webp","WEBP",lossless=True,method=6)

# Five exact approved mint portal marks; keep source RGB pixels in all nontransparent regions.
icons={"radar":(61,582,138,645),"replay":(381,581,460,645),
       "ledger":(694,580,770,645),"creator":(1011,579,1094,646),
       "watch":(1308,579,1390,646)}
for name,coords in icons.items():
    arr=np.asarray(home.crop(coords)).copy()
    r,g,b=[arr[:,:,i].astype(np.int16) for i in range(3)]
    alpha=((g-r>27)&(b-r>16)&(g>100)&(g<245)).astype(np.uint8)*255
    n,lab,stats,_=cv2.connectedComponentsWithStats((alpha>0).astype(np.uint8),8)
    keep=np.isin(lab,[i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>12])
    arr[:,:,3]=cv2.dilate(keep.astype(np.uint8),np.ones((3,3),np.uint8),iterations=1)*255
    icon=Image.fromarray(arr,"RGBA")
    box=icon.getbbox()
    if not box:
        raise SystemExit("EMPTY_ICON " + name)
    icon.crop(box).save(OUT/f"portal-{name}-icon.png",optimize=True)

manifest={
 "status":"G0_CANDIDATE_OWNER_REVIEW_PENDING",
 "exact_source_git_blobs":EXPECTED,
 "canonical_bbox":list(master_bbox),"home_visible_bbox":list(home_bbox),
 "portal_illustrations":list(panels.keys()),
 "source_pixel_law":"Canonical character and Home visible rat RGB only; alpha mask does not invent occluded pixels.",
 "known_limitations":["Master images flattened; masked edges require owner/manual review.",
     "No hidden skyline, missing rat back, or dumpster pixels behind portal rail can be recovered.",
     "Illustrations are decorative. No mock data or event rows may be presented as live evidence."],
 "mobile_crop_source_pixels":[575,0,1355,1080],
}
(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("G0_ASSETS_GENERATED", len(list(OUT.iterdir())))
print("G0_SRC_BLOBS",json.dumps(EXPECTED,sort_keys=True))
print("G0_FIRST_VIEW_WEBP_BYTES",
 (OUT/"world-desktop-1536.webp").stat().st_size+(OUT/"home-visible-rat-dumpster.webp").stat().st_size,
 (OUT/"world-phone-585x810.webp").stat().st_size+(OUT/"home-visible-rat-dumpster-500w.webp").stat().st_size)
