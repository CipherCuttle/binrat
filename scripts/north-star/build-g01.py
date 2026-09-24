#!/usr/bin/env python3
"""BINRAT G0.1 visual review: exact-master-based physical portals + staged compositions.

Master sources must match the exact Git blobs in docs/design/north-star.
This is a review renderer, not production CSS. No fake observed receipts are rendered.
Production app integration remains gated by the owner.
"""
from __future__ import annotations
from pathlib import Path
import argparse, hashlib, json, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import cv2

P=argparse.ArgumentParser();P.add_argument('--source',type=Path,default=Path('/mnt/data/files'))
P.add_argument('--out',type=Path,default=Path('/mnt/data/binrat-g01'))
a=P.parse_args();S=a.source;OUT=a.out; ART=OUT/'art';REV=OUT/'review';ART.mkdir(parents=True,exist_ok=True);REV.mkdir(parents=True,exist_ok=True)
files={
 'binrat-character-master.png':('56c437f8-98f9-4eae-887f-cfcc40c26dff(1).png','db53e725e52f871f6eb2eb185a8dfef17425b3d9'),
 'binrat-world-background.png':('Untitled design.png','42557b90197f924c5b34bb44204c6d7bdbc6c832'),
 'binrat-home-north-star.png':('Binrat: The Rat Remembers.png','8cf7c81cc6b6d82e8ef61d3280f53b856e6c7243')
}
def gitsha(path):
    b=path.read_bytes();return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
masters={}
for key,(f,sha) in files.items():
    p=S/f
    if not p.is_file() and (S/key).is_file(): p=S/key
    assert p.is_file(),f'MISSING_MASTER {p}'
    assert gitsha(p)==sha,(key,gitsha(p),sha)
    masters[key]=Image.open(p).convert('RGBA')
home=masters['binrat-home-north-star.png'];world=masters['binrat-world-background.png']
# Reuse owner-image G0 segmentation where repo assets exist; fallback local exact-source seeded matte.
g0=next((p for p in (S/'north-star-g0'/'home-visible-rat-dumpster.png', S.parents[2]/'web-v2/public/north-star-g0/home-visible-rat-dumpster.png', S.parent/'web-v2/public/north-star-g0/home-visible-rat-dumpster.png') if p.exists()), S/'north-star-g0'/'home-visible-rat-dumpster.png')
if g0.exists(): subject=Image.open(g0).convert('RGBA')
else:
    arr=np.array(home);H,W=arr.shape[:2]
    poly=np.array([(718,570),(718,515),(731,477),(731,438),(742,405),(739,368),(748,326),(744,287),(772,254),(831,262),(862,273),(900,250),(945,241),(974,210),(992,171),(1004,132),(1033,94),(1074,90),(1115,109),(1177,116),(1206,143),(1256,140),(1305,166),(1333,206),(1327,251),(1374,267),(1389,290),(1381,326),(1435,347),(1524,387),(1570,467),(1610,521),(1647,553),(1647,580)],np.int32)
    seed=np.zeros((H,W),np.uint8);cv2.fillPoly(seed,[poly],1)
    cv2.polylines(seed,[np.array([(977,245),(994,208),(972,174),(940,152),(907,159),(872,186),(865,215),(903,234)],np.int32)],False,1,19)
    inner=cv2.erode(seed,np.ones((17,17),np.uint8),iterations=1);outer=cv2.dilate(seed,np.ones((17,17),np.uint8),iterations=1)
    mask=np.full((H,W),cv2.GC_BGD,np.uint8);mask[outer>0]=cv2.GC_PR_BGD;mask[seed>0]=cv2.GC_PR_FGD;mask[inner>0]=cv2.GC_FGD
    cv2.grabCut(arr[:,:,:3].copy(),mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_MASK)
    alpha=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)).astype('uint8')*255
    alpha=cv2.morphologyEx(alpha,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    arr[:,:,3]=np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.28)))
    subject=Image.fromarray(arr).crop((718,80,1648,574))
    subject.save(ART/'source-home-subject-local-mask.png')
# Font family for visual review only, not shipped UI.
fontpaths={
 'display':'/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
 'bold':'/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
 'regular':'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
 'mono':'/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
}
def f(k,size):return ImageFont.truetype(fontpaths[k],size)
cream='#fff1d3';gold='#ffca58';navy='#151725';charcoal='#101824';mint='#9ce5d6';gray='#a9b6c3';orange='#ff9953'
def tx(d,xy,txt,size=15,c=cream,k='regular',stroke=0,fill=None):
    d.text(xy,txt,font=f(k,size),fill=c,stroke_width=stroke,stroke_fill=fill)

def draw_frame(im,seed=42):
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,599,269),fill='#0d1521',outline='#71808b',width=3)
    d.rectangle((8,7,591,263),outline='#374453',width=2)
    for cx,cy in ((12,13),(586,13),(12,256),(586,256)):
        d.ellipse((cx-3,cy-3,cx+3,cy+3),fill='#81684e',outline='#bda17b')
    rng=random.Random(seed)
    for _ in range(1800):
        x=rng.randrange(15,585);y=rng.randrange(14,256)
        if rng.random()<0.75:d.point((x,y),fill=rng.choice(('#233041','#1b2634','#151e30')))
    return d

def crt_art():
    im=Image.new('RGB',(600,270));d=draw_frame(im,32)
    d.rounded_rectangle((38,20,562,237),radius=22,fill='#3f443a',outline='#857157',width=9)
    d.rounded_rectangle((56,37,543,215),radius=13,fill='#05271e',outline='#131e1b',width=6)
    for y in range(48,209,6):d.line((65,y,531,y),fill='#10392e',width=1)
    # Stationary decorative scan sweep, no markers/address counts.
    cx,cy=305,124
    for r in (26,52,78,100):d.ellipse((cx-r,cy-r//2,cx+r,cy+r//2),outline='#376958',width=2)
    for angle in (0,45,90,135):
        v=math.radians(angle);dx=math.cos(v)*119;dy=math.sin(v)*61
        d.line((cx-dx,cy-dy,cx+dx,cy+dy),fill='#245548',width=1)
    d.arc((192,67,416,183),190,282,fill='#b0f1b5',width=5)
    d.ellipse((cx-7,cy-7,cx+7,cy+7),outline=mint,width=2)
    d.rectangle((33,243,83,249),fill='#ac6b48');d.rectangle((94,243,220,248),fill='#53594b')
    return im

def replay_art():
    im=Image.new('RGB',(600,270));d=draw_frame(im,72)
    d.rounded_rectangle((20,27,580,245),radius=10,fill='#313c42',outline='#a87c53',width=6)
    d.rectangle((37,43,561,228),fill='#141c28',outline='#72818c',width=3)
    # Four time-separated EMPTY frames. No cameras/people/fake tracked activity.
    for i in range(4):
        x=51+i*129
        d.rectangle((x,61,x+110,190),fill='#0b2a2c',outline='#b69b75',width=3)
        d.rectangle((x+8,71,x+102,181),fill='#162a35',outline='#526d77',width=2)
        d.arc((x+18,81,x+92,158),200,325,fill='#8eb8a9',width=3)
        d.rectangle((x+16,164,x+55,168),fill='#487766')
        for y in range(48,220,30):
            if i%2==0:d.line((x+3,y,x+10,y),fill='#d8b37f',width=2)
    d.line((48,207,544,207),fill='#ad9f7e',width=3)
    for i in range(4):d.ellipse((99+i*128,203,108+i*128,212),fill=gold)
    return im

def ledger_art():
    im=Image.new('RGB',(600,270));d=draw_frame(im,88)
    d.polygon([(105,34),(340,21),(475,55),(448,229),(151,234)],fill='#5c453a',outline='#aa7f5e',width=5)
    d.polygon([(152,36),(422,47),(461,214),(166,228)],fill='#d6c49b',outline='#ac8858',width=4)
    d.rectangle((180,69,392,78),fill='#514b40')
    d.rectangle((180,90,362,95),fill='#85775e')
    d.rectangle((180,112,411,117),fill='#85775e')
    for y in (146,171,195):
        d.line((180,y,413,y),fill='#b4a17e',width=2)
        d.rectangle((178,y-4,186,y+4),outline='#8a775c',width=2)
    d.ellipse((334,111,448,225),fill='#b98e4c',outline='#5d4932',width=6)
    d.ellipse((347,124,435,212),outline='#f7d391',width=2)
    d.line((354,211,435,128),fill='#6f4e28',width=4)
    # Empty ledger sheet, no cash values, token prices or implied launched asset.
    return im

def creator_art():
    im=Image.new('RGB',(600,270));d=draw_frame(im,115)
    d.polygon([(83,45),(239,45),(259,61),(496,61),(496,231),(83,231)],fill='#96764e',outline='#3f372c',width=6)
    d.polygon([(106,83),(479,83),(456,241),(121,238)],fill='#ecd8aa',outline='#ae8a5c',width=4)
    d.rectangle((148,102,431,145),fill='#c1b18c',outline='#8e7559',width=2)
    # Empty ADDRESS slots; deliberately NO portrait / human identity.
    for i in range(12):
        x=159+i*20;d.rectangle((x,113,x+12,134),outline='#635a4a',width=2)
    for y in (162,185,206):d.line((152,y,434,y),fill='#9c886c',width=3)
    d.rectangle((109,77,135,230),fill='#bd9a68',outline='#997449',width=2)
    d.ellipse((461,51,479,69),fill='#a25d43',outline='#523a36')
    return im

def watch_art():
    im=Image.new('RGB',(600,270));d=draw_frame(im,144)
    d.rounded_rectangle((75,41,526,226),radius=12,fill='#283139',outline='#987653',width=7)
    d.rounded_rectangle((99,63,405,206),radius=5,fill='#102129',outline='#556f6d',width=3)
    # Source→external-hand-off circuit, static cable and airplane; no fake delivered alerts.
    d.line((124,161,208,161,208,124,286,124,332,95),fill='#8ce0c6',width=6,joint='curve')
    d.ellipse((113,152,135,174),fill='#152d27',outline=mint,width=4)
    d.polygon([(246,86),(344,114),(285,128),(273,158),(246,86)],fill='#deb976',outline='#f2d89c',width=3)
    d.line((273,158,285,128),fill='#74593b',width=3)
    d.rectangle((422,77,478,148),fill='#6d463b',outline='#c49858',width=5)
    d.ellipse((430,84,470,124),fill='#372a27',outline='#cf674a',width=4)
    d.ellipse((439,93,461,115),fill='#a15c42')
    for y in (160,178,196):d.line((417,y,488,y),fill='#556b64',width=3)
    return im

makers={'radar':crt_art,'replay':replay_art,'ledger':ledger_art,'creator':creator_art,'watch':watch_art}
for name,func in makers.items():
    im=func();im.save(ART/f'portal-{name}-g01.png',optimize=True); im.save(ART/f'portal-{name}-g01.webp',format='WEBP',lossless=True,method=6)

# Exact-master-derived world and foreground; the reference does not reveal background hidden by the rat.
# Local fallback matte is review-only. GH build reads tested G0 extraction.
background=world.crop((0,0,1920,840)).resize((1672,730),Image.Resampling.LANCZOS).convert('RGB')
# Distressed display text for the mockup. Degraded pixels are intentionally deterministic.
def distressed_text(canvas,xy,txt,sz,color=cream,maxw=None):
    ft=f('display',sz);box=ft.getbbox(txt);w,h=box[2]-box[0],box[3]-box[1]
    ink=Image.new('L',(w+6,h+9));dd=ImageDraw.Draw(ink);dd.text((3-box[0],2-box[1]),txt,font=ft,fill=255,stroke_width=1)
    rng=random.Random(len(txt)+sz)
    idraw=ImageDraw.Draw(ink)
    for _ in range(int(w*h*.005)):
        px=rng.randrange(ink.width);py=rng.randrange(ink.height)
        if 1<px<ink.width-2 and 1<py<ink.height-2:
            idraw.rectangle((px,py,px+rng.randrange(1,4),py+rng.randrange(1,3)),fill=0)
    if maxw and w>maxw:ink=ink.resize((maxw,ink.height),Image.Resampling.NEAREST)
    face=Image.new('RGBA',ink.size,color);face.putalpha(ink)
    canvas.paste(face,xy,face)

def draw_desktop():
    W,H=1672,941;im=Image.new('RGB',(W,H),navy);im.paste(background.crop((0,0,W,492)),(0,72))
    # Street foreground is exact-owner sky + first-visible city pixels only.
    city=home.crop((0,438,719,572));c_mask=Image.new('L',city.size);cd=ImageDraw.Draw(c_mask)
    # Restrict to opaque skyline bottom, avoiding hero/text above original horizon.
    cd.polygon([(0,43),(40,26),(69,68),(95,53),(117,72),(156,51),(194,65),(229,43),(252,69),(280,57),(317,65),(344,70),(380,57),(407,59),(453,64),(477,42),(505,62),(541,59),(576,37),(617,62),(666,72),(719,57),(719,134),(0,134)],fill=255)
    city.putalpha(c_mask);im.paste(city,(0,430),city)
    # Preserve exact Home subject, no redesign, red viewer-right eye.
    fg=subject.copy();fg.thumbnail((944,520),Image.Resampling.LANCZOS)
    im.paste(fg,(714,84),fg)
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,72),fill='#171728');d.line((0,71,W,71),fill='#d99b69',width=2)
    # Icon from reference (illustrative physical logo only), not generated rat.
    mark=home.crop((90,18,147,74)).convert('RGB');im.paste(mark.resize((54,54),Image.Resampling.LANCZOS),(70,11))
    tx(d,(130,11),'BINRAT',37,k='bold');tx(d,(131,51),'TRASH IN. TRUTH OUT.',10,c=gold,k='mono')
    for x,label in [(388,'HOME'),(470,'DUMPSTER'),(593,'RADAR'),(689,'REPLAY'),(799,'LEDGER'),(911,'WATCH')]:tx(d,(x,29),label,16,k='bold')
    d.rectangle((1214,16,1425,57),fill='#252236',outline='#7d6b86',width=2)
    tx(d,(1230,27),'PUBLIC / LIVE',15,c=cream,k='mono')
    d.rectangle((1437,16,1599,57),fill='#171728',outline='#e6c59d',width=2);tx(d,(1468,27),'METHOD  ↗',15,k='bold')
    tx(d,(92,107),'OPEN-SOURCE LAUNCH INTELLIGENCE / ARC 5042',16,k='mono',c='#ffdaa1')
    distressed_text(im,(87,142),'THE RAT',84,maxw=548);distressed_text(im,(88,220),'REMEMBERS',78,maxw=570)
    d=ImageDraw.Draw(im)
    tx(d,(94,319),'Trace public launch activity to its source-reported addresses.',18,c='#20233c',k='bold',stroke=1,fill='#fff7e2')
    tx(d,(94,345),'Inspect indexed receipts and replay what was knowable.',18,c='#20233c',k='bold',stroke=1,fill='#fff7e2')
    d.rectangle((92,390,501,452),fill=gold,outline='#523623',width=3)
    tx(d,(124,409),'ENTER THE DUMPSTER  →',22,c='#1b1b23',k='bold')
    # Truthful compact status: do not manufacture block, counts, freshness.
    d.rectangle((92,474,656,532),fill='#161e2c',outline='#d7bf8b',width=2)
    tx(d,(109,482),'PUBLIC LIVE',14,k='bold',c=mint)
    tx(d,(220,482),'ARC 5042',14,k='mono',c=cream)
    tx(d,(348,482),'READ-ONLY',14,k='bold',c=cream)
    tx(d,(109,504),'CHECKPOINT / API-DRIVEN',12,k='mono',c='#bac2c4')
    tx(d,(365,504),'COVERAGE / API-DRIVEN',12,k='mono',c='#bac2c4')
    # Five physical portal doors, all have equal visual weight and truthful separate capability.
    d.rectangle((0,550,1672,837),fill='#0c1421')
    panel_info=[('radar','RAT RADAR','Observe recipient recurrence','PUBLIC / OBSERVED'),
                ('replay','REPLAY LAB','Inspect time-sliced receipts','EVIDENCE / FROZEN'),
                ('ledger','LEDGER','Understand available history','PRELAUNCH / LIMITED'),
                ('creator','CREATOR FILES','Source-reported address files','NO HUMAN ATTRIBUTION'),
                ('watch','WATCH','Prepare Telegram alerts','CONFIRM IN TELEGRAM')]
    x0=44;gap=11;pw=308
    for i,(name,label,desc,status) in enumerate(panel_info):
        x=x0+i*(pw+gap); y=562
        d.rectangle((x,y,x+pw,y+261),fill='#111b29',outline='#b7a28a',width=2)
        d.rectangle((x+8,y+8,x+pw-8,y+65),fill='#172534')
        tx(d,(x+19,y+15),label,22,k='bold')
        tx(d,(x+19,y+45),desc,12,c='#e7dfd3')
        art=Image.open(ART/f'portal-{name}-g01.png').convert('RGB')
        art=art.crop((24,10,576,255)).resize((pw-24,128),Image.Resampling.LANCZOS)
        im.paste(art,(x+12,y+72))
        # Draw art border after image paste.
        d=ImageDraw.Draw(im);d.rectangle((x+10,y+70,x+pw-10,y+202),outline='#72848f',width=2)
        d.rectangle((x+11,y+210,x+pw-11,y+249),fill='#192332')
        tx(d,(x+19,y+223),status,12,k='mono',c='#f7c788')
        tx(d,(x+pw-35,y+214),'↗',22,k='bold')
    d.rectangle((0,838,W,940),fill='#171e2c')
    d.rectangle((47,851,1624,931),outline='#a89c8a',width=2)
    tx(d,(70,858),'THE RAT REMEMBERS.',22,k='bold')
    tx(d,(70,885),'PUBLIC EVIDENCE. NOT A TRADING SIGNAL.',14,c='#bfc9d0',k='mono')
    tx(d,(515,866),'Receipts first. Address roles, not human identities.',17,c=cream)
    tx(d,(515,894),'Open methodology to inspect sources and coverage.',14,c='#c4c7c9')
    d.rectangle((1330,862,1603,920),fill='#22202b',outline='#ecd19b',width=2)
    tx(d,(1371,881),'OUR METHOD  ↗',18,k='bold')
    path=REV/'g01-desktop-1672x941.png';im.save(path,optimize=True);return im

def draw_mobile():
    W,H=390,1442;im=Image.new('RGB',(W,H),'#151828');d=ImageDraw.Draw(im)
    d.rectangle((0,0,390,62),fill='#171728');mark=home.crop((90,18,147,74)).convert('RGB').resize((38,38))
    im.paste(mark,(14,11));tx(d,(56,13),'BINRAT',26,k='bold');tx(d,(333,10),'☰',35)
    world_phone=world.crop((300,100,1530,910)).resize((390,265),Image.Resampling.LANCZOS).convert('RGB')
    im.paste(world_phone,(0,62));fg=subject.copy();fg.thumbnail((478,296),Image.Resampling.LANCZOS)
    # Art direction: center face; preserve image boundaries and exact red eye.
    im.paste(fg,(-29,62),fg)
    d=ImageDraw.Draw(im);d.rectangle((0,327,390,447),fill='#191b2a')
    distressed_text(im,(17,338),'THE RAT',45,maxw=322)
    distressed_text(im,(17,379),'REMEMBERS',41,maxw=362)
    d=ImageDraw.Draw(im)
    d.rectangle((0,447,390,501),fill='#191b2a')
    tx(d,(18,451),'Trace public Arc launches to their reported',15,c='#f4f0e8')
    tx(d,(18,473),'addresses. Inspect actual source receipts.',15,c='#f4f0e8')
    d.rectangle((16,511,374,571),fill=gold,outline='#5c3d25',width=2)
    tx(d,(35,528),'ENTER THE DUMPSTER  →',21,c='#171825',k='bold')
    d.rectangle((16,580,374,634),fill='#111b29',outline='#b9a182',width=2)
    tx(d,(30,588),'PUBLIC LIVE  ·  ARC 5042  ·  READ-ONLY',12,c=mint,k='bold')
    tx(d,(30,610),'Checkpoint / coverage: view live status',11,c='#ebdcbd',k='mono')
    d.rectangle((0,645,390,770),fill='#0b1521')
    tx(d,(17,651),'FIRST STOP / RAT RADAR',13,k='bold',c='#f5c981')
    art=Image.open(ART/'portal-radar-g01.png').convert('RGB').crop((40,19,554,235)).resize((144,94),Image.Resampling.LANCZOS)
    im.paste(art,(16,672));d=ImageDraw.Draw(im)
    d.rectangle((16,671,374,764),outline='#aa9d86',width=2)
    tx(d,(168,686),'RAT RADAR  ↗',18,k='bold')
    tx(d,(168,717),'Inspect observed',13)
    tx(d,(168,734),'recipient recurrence',13)
    d.rectangle((0,773,390,840),fill='#0f1622')
    for x,name in [(26,'DISCOVER'),(133,'RADAR'),(221,'SAVED'),(308,'MORE')]:
        tx(d,(x,794),name,12,k='bold',c=gold if name=='DISCOVER' else '#e9e4dd')
    # Full-scroll panel sheet starts after the pinned nav preview edge, not behind it.
    y=854
    tx(d,(20,y),'EXPLORE THE WORKBENCH',20,k='bold');y+=43
    small=[('replay','REPLAY LAB','Time-sliced evidence'),('ledger','LEDGER','Launch history / prelaunch limits'),
            ('creator','CREATOR FILES','Source-reported addresses'),('watch','WATCH','Telegram handoff / confirmation')]
    for name,label,desc in small:
        d.rectangle((16,y,374,y+115),fill='#142031',outline='#998977',width=2)
        art=Image.open(ART/f'portal-{name}-g01.png').convert('RGB').crop((40,19,554,235)).resize((138,89),Image.Resampling.LANCZOS)
        im.paste(art,(28,y+13));d=ImageDraw.Draw(im)
        tx(d,(176,y+20),label,18,k='bold');tx(d,(176,y+52),desc,11)
        tx(d,(332,y+76),'↗',22,k='bold');y+=127
    im.crop((0,0,390,844)).save(REV/'g01-mobile-firstview-390x844.png',optimize=True)
    im.save(REV/'g01-mobile-scroll-390x1442.png',optimize=True)
    return im

desktop=draw_desktop();mobile=draw_mobile()
old=Image.open('/mnt/data/binrat-g0/previews/g0-layered-desktop-1672x941.png').convert('RGB') if Path('/mnt/data/binrat-g0/previews/g0-layered-desktop-1672x941.png').exists() else home.convert('RGB')
comp=Image.new('RGB',(1672,1882),'#0d1220');comp.paste(old,(0,0));comp.paste(desktop,(0,941));comp.save(REV/'g01-desktop-before-after.jpg',quality=91)
# Contact sheet: no mock dynamic data in actual isolated art PNGs.
sheet=Image.new('RGB',(3*600,2*320),'#141929');d=ImageDraw.Draw(sheet)
for i,(name,fn) in enumerate(makers.items()):
    x=(i%3)*600;y=(i//3)*320
    sheet.paste(Image.open(ART/f'portal-{name}-g01.png'),(x,y+40))
    tx(d,(x+20,y+8),name.upper()+' / EMPTY ILLUSTRATION',21,k='bold')
sheet.save(REV/'g01-portal-art-contact.png',optimize=True)
manifest={'phase':'G0.1_OWNER_VISUAL_REVIEW_PENDING','source_git_blobs':{k:v[1] for k,v in files.items()},
 'assets':[f'portal-{k}-g01.webp' for k in makers],
 'semantic_law':'All panels decorative/empty. No mock transactions, observed counts, people, geo coordinates or presumed delivered alerts.',
 'render_scope':'Flat preview composites only; not a browser capture or merged frontend',
 'owner_visual_gate':'OPEN','limitations':['Foreground segmentation cannot recover unseen source pixels.',
  'Review subject matte on dark/bright backgrounds and accept visual composition before HomeScene integration.'],
 'viewport':[1672,941,390,844]}
(OUT/'g01-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('G01_PROVENANCE: PASS',len(makers),'DECORATIVE_PORTALS',len(list(REV.glob('*.png'))),'REVIEW_PNGS')
for k in makers:
    p=ART/f'portal-{k}-g01.webp';print('PORTAL',k,p.stat().st_size,'bytes')
print('DESKTOP',REV/'g01-desktop-1672x941.png');print('MOBILE',REV/'g01-mobile-firstview-390x844.png')