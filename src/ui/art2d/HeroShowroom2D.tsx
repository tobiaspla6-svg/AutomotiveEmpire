/**
 * Automotive Empire — cinematic 2D showroom.
 *
 * A hand-authored vector scene, not a bitmap render. All geometry is SVG and
 * can recolor from the player's vehicle/company paint. No WebGL or third-party
 * images; this is deliberately cheaper than loading a car GLB for the menu.
 *
 * Art direction: European GT design studio, three-quarter camera, physically
 * understandable wheel stance, layered metallic paint, 3-point studio light.
 */
import { memo, useId } from 'react';
import type { BodyType } from '../../sim/types';
import { shade } from './svg';

type Props = {
  color?: string;
  body?: BodyType;
  label?: string;
  /** In the workshop the stage is lighter and the floating menu tag is hidden. */
  compact?: boolean;
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

function ForgedWheel({ x, y, r, skinny = false, tint }: { x: number; y: number; r: number; skinny?: boolean; tint: string }) {
  const ry = r * (skinny ? .76 : .92);
  return <g>
    <ellipse cx={x + 3} cy={y + r*.85} rx={r*1.38} ry={r*.42} fill="#050911" opacity=".45"/>
    <ellipse cx={x} cy={y} rx={r*1.05} ry={ry*1.04} fill="#060a11" stroke="#232b35" strokeWidth="5"/>
    <ellipse cx={x} cy={y} rx={r*.82} ry={ry*.82} fill="#9caebd" stroke="#d6dfe7" strokeWidth="2"/>
    <ellipse cx={x} cy={y} rx={r*.71} ry={ry*.71} fill="#1b2838" stroke="#485f70" strokeWidth="3"/>
    {Array.from({length:10},(_,i)=>{
      const a=i*Math.PI/5 - Math.PI/2, dx=Math.cos(a), dy=Math.sin(a);
      return <path key={i} d={'M '+(x+dx*r*.14).toFixed(1)+' '+(y+dy*ry*.14).toFixed(1)+
          ' L '+(x+dx*r*.64).toFixed(1)+' '+(y+dy*ry*.64).toFixed(1)}
        stroke={i%2?'#ced7dd':'#899eaf'} strokeWidth={skinny?5:6} strokeLinecap="round"/>;
    })}
    <circle cx={x} cy={y} r={r*.125} fill="#d8e0e7" stroke="#263849" strokeWidth="3"/>
    {Array.from({length:5},(_,i)=>{
      const a=i*Math.PI*2/5;
      return <circle key={i} cx={x+Math.cos(a)*r*.24} cy={y+Math.sin(a)*ry*.24} r={r*.044} fill="#111c28"/>;
    })}
    <path d={'M'+(x-r*.7)+' '+(y+r*.14)+'A'+(r*.70)+' '+(ry*.72)+' 0 0 0 '+(x+r*.7)+' '+(y+r*.14)}
      fill="none" stroke={tint} strokeWidth={r*.10} opacity=".75"/>
    <ellipse cx={x} cy={y} rx={r*.98} ry={ry*.98} fill="none" stroke="#e2ebf2" strokeWidth="1" opacity=".28"/>
  </g>;
}

export const HeroShowroom2D = memo(function HeroShowroom2D({
  color = '#315b8e', body = 'sedan', label = 'Premium vehicle showroom', compact = false,
}: Props) {
  const uid = useId().replace(/[^A-Za-z0-9]/g,'');
  const g = (n: string) => 'url(#'+n+uid+')';
  const safeColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#315b8e';
  const dark = shade(safeColor,-.47), deep = shade(safeColor,-.65), light = shade(safeColor,.27);
  const isSUV = body === 'suv' || body === 'pickup', isGT = body === 'coupe' || body === 'roadster' || body === 'supercar';
  // The greenhouse is a live SVG variant. More vehicles get different native
  // rooflines; catalogue side views continue to handle every historical type.
  const roofDelta = isSUV ? -42 : isGT ? 28 : 0;
  const rearRoof = 296 + roofDelta, topRoof = 266 + roofDelta, glassRoof = 294 + roofDelta;
  const roof = isGT
    ? 'M425 '+(rearRoof+33)+' Q525 '+topRoof+' 660 '+(topRoof+4)+' Q746 '+(topRoof+11)+' 817 340'
    : isSUV
      ? 'M407 '+(rearRoof+20)+' Q470 '+topRoof+' 640 '+topRoof+' L778 '+(topRoof+20)+' Q815 '+(topRoof+22)+' 849 344'
      : 'M428 '+(rearRoof+26)+' Q508 '+topRoof+' 647 '+topRoof+' Q754 '+(topRoof+7)+' 836 349';
  const glass = isSUV
    ? 'M439 345 Q481 '+(glassRoof+3)+' 639 '+glassRoof+' L771 '+(glassRoof+18)+' Q798 319 823 358 L650 397 L456 384Z'
    : isGT
      ? 'M471 347 Q537 '+(glassRoof-3)+' 665 '+(glassRoof-2)+' Q733 '+(glassRoof+8)+' 803 352 L683 393 L467 382Z'
      : 'M453 343 Q515 '+glassRoof+' 647 '+glassRoof+' Q743 '+(glassRoof+6)+' 811 355 L665 401 L459 384Z';
  const wheelSize = isSUV ? 63 : isGT ? 66 : 61;
  return <svg className={'ae-hero-showroom'+(compact?' compact':'')} viewBox="0 0 1280 720"
    role="img" aria-label={label} focusable="false" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id={'studioSky'+uid} x1="0" x2=".1" y1="0" y2="1">
        <stop stopColor="#0d1929"/><stop offset=".55" stopColor="#182b3c"/><stop offset="1" stopColor="#283845"/>
      </linearGradient>
      <linearGradient id={'studioFloor'+uid} x1="0" x2=".15" y1="0" y2="1">
        <stop stopColor="#33424d"/><stop offset=".54" stopColor="#1d2b35"/><stop offset="1" stopColor="#0c1420"/>
      </linearGradient>
      <linearGradient id={'glass'+uid} x1="0" x2="1" y1=".2" y2=".95">
        <stop stopColor="#a4d0e0"/><stop offset=".21" stopColor="#33617c"/><stop offset=".55" stopColor="#0d2034"/><stop offset="1" stopColor="#081a2a"/>
      </linearGradient>
      <linearGradient id={'paintTop'+uid} x1=".27" x2=".87" y1="0" y2="1">
        <stop stopColor={light}/><stop offset=".20" stopColor={safeColor}/><stop offset=".58" stopColor={dark}/><stop offset=".87" stopColor={light}/><stop offset="1" stopColor={deep}/>
      </linearGradient>
      <linearGradient id={'paintSide'+uid} x1="0" x2=".1" y1="0" y2="1">
        <stop stopColor={light}/><stop offset=".17" stopColor={safeColor}/><stop offset=".50" stopColor={dark}/><stop offset=".83" stopColor={safeColor}/><stop offset="1" stopColor={deep}/>
      </linearGradient>
      <linearGradient id={'paintNose'+uid} x1="0" x2="1" y1=".1" y2=".8">
        <stop stopColor={safeColor}/><stop offset=".32" stopColor={light}/><stop offset=".67" stopColor={safeColor}/><stop offset="1" stopColor={dark}/>
      </linearGradient>
      <linearGradient id={'lamp'+uid} x1="0" x2="1" y1="0" y2="1">
        <stop stopColor="#d7eff8"/><stop offset=".35" stopColor="#5e8ca0"/><stop offset=".85" stopColor="#192c40"/><stop offset="1" stopColor="#0b1423"/>
      </linearGradient>
      <radialGradient id={'headlight'+uid}><stop stopColor="#e3faff" stopOpacity=".9"/><stop offset=".36" stopColor="#8bc9ec" stopOpacity=".30"/><stop offset="1" stopColor="#79bcea" stopOpacity="0"/></radialGradient>
      <radialGradient id={'shadow'+uid}><stop stopColor="#030810" stopOpacity=".9"/><stop offset=".58" stopColor="#05090f" stopOpacity=".58"/><stop offset="1" stopColor="#07111d" stopOpacity="0"/></radialGradient>
      <linearGradient id={'roof'+uid} x1=".3" x2=".87" y1="0" y2="1">
        <stop stopColor="#ccd7dd"/><stop offset=".12" stopColor="#4c7185"/><stop offset=".32" stopColor="#111f30"/><stop offset=".68" stopColor="#0c1b2a"/><stop offset=".97" stopColor="#567c90"/>
      </linearGradient>
      <linearGradient id={'tire'+uid} x1="0" x2="1" y1=".3" y2=".9">
        <stop stopColor="#02050b"/><stop offset=".38" stopColor="#263341"/><stop offset=".8" stopColor="#050910"/><stop offset="1" stopColor="#111b27"/>
      </linearGradient>
      <filter id={'softGlow'+uid} x="-80%" y="-200%" width="260%" height="500%"><feGaussianBlur stdDeviation="12"/></filter>
      <filter id={'floorBlur'+uid} x="-40%" y="-50%" width="180%" height="210%"><feGaussianBlur stdDeviation="29"/></filter>
      <clipPath id={'glassClip'+uid}><path d={glass}/></clipPath>
    </defs>

    {/* Purpose-designed automotive design studio with real perspective. */}
    <path fill={g('studioSky')} d="M0 0H1280V720H0Z"/>
    <g opacity=".78">
      <path d="M0 0h1280v301H0Z" fill="#101b2a"/>
      {Array.from({length:6},(_,i)=>{
        const x=i*224-30;
        return <g key={i}>
          <path d={'M'+x+' 28h207l-8 246h-200Z'} fill={i%2?'#16283b':'#1c344a'} stroke="#34465a" strokeWidth="2"/>
          <path d={'M'+(x+19)+' 42h165l-7 213H'+(x+12)+'Z'} fill={g('glass')} opacity=".54"/>
          <path d={'M'+(x+101)+' 42v216'} stroke="#8eb5c6" strokeOpacity=".16" strokeWidth="3"/>
          <path d={'M'+(x+10)+' 202h178'} stroke="#8eb5c6" strokeOpacity=".14" strokeWidth="3"/>
        </g>;
      })}
      <rect y="252" width="1280" height="33" fill="#141d2a"/>
      <path d="M0 277H1280" stroke="#839eac" strokeOpacity=".55" strokeWidth="3"/>
      <path d="M0 285H1280" stroke="#080e1b" strokeWidth="13"/>
      {Array.from({length:7},(_,i)=><g key={i} opacity=".9">
        <path d={'M'+(i*225+10)+' 0L'+(i*225-10)+' 274'} stroke="#566b79" strokeWidth="9" opacity=".39"/>
        <path d={'M'+(i*225+50)+' 0L'+(i*225+20)+' 274'} stroke="#0c1420" strokeWidth="13"/>
      </g>)}
    </g>
    <path fill={g('studioFloor')} d="M0 283H1280V720H0Z"/>
    {Array.from({length:9},(_,i)=> <path key={i} d={'M'+(i*148-90)+' 720L'+(640+(i-4)*27)+' 277'} stroke="#a1b7c4" strokeOpacity=".105" strokeWidth="2"/>)}
    {[330,396,491,628].map(y=><path key={y} d={'M0 '+y+'H1280'} stroke="#a1b7c4" strokeOpacity=".085" strokeWidth={y===491?3:2}/>)}
    <path d="M108 402L1124 311L1280 404V427L107 510Z" fill="#a1cee0" opacity=".038"/>
    <path d="M0 284h1280" stroke="#d9e0e4" strokeOpacity=".12" strokeWidth="4"/>
    {/* Ceiling softboxes reflected in both the background and car. */}
    <g>
      <path d="M100 64L537 23l-22 29L113 88Z" fill="#b8e4eb" opacity=".06" filter={g('softGlow')}/>
      <path d="M152 49L486 20l-12 12L152 61Z" fill="#c5eef7" opacity=".77"/>
      <path d="M770 17L1095 56l-14 12L756 31Z" fill="#c8ebef" opacity=".85"/>
      <path d="M822 89L1139 135l-16 13L807 101Z" fill="#f7e3c1" opacity=".4"/>
    </g>
    <path d="M87 549Q393 463 807 473Q1117 473 1244 558L1144 628Q503 705 83 592Z" fill="#b1bdca" opacity=".045"/>
    <ellipse cx="665" cy="579" rx="490" ry="93" fill={g('shadow')}/>
    <ellipse cx="675" cy="613" rx="350" ry="49" fill="#c3d7e0" opacity=".13" filter={g('floorBlur')}/>
    <path d="M430 613Q710 638 1073 602" stroke="#b8c8cf" strokeWidth="4" opacity=".08" filter={g('softGlow')}/>

    {/* The vehicle: chassis/sill, two correctly ellipsoidal wheels, cabin,
        continuous side body, curved bonnet, real front fascia and lamp depth. */}
    <g className="ae-hero-vehicle">
      <ellipse cx="685" cy="599" rx="390" ry="45" fill="#01040a" opacity=".55"/>
      <path d="M254 505Q336 473 442 465L890 464L1102 477L1139 534Q1078 573 926 584L420 571L290 542Z"
        fill="#070d17" stroke="#1f3447" strokeWidth="5"/>
      {/* Far-side wheel, intentionally partially occluded by the body. */}
      <ellipse cx="1028" cy="509" rx="45" ry="62" fill="#04070d" stroke="#202f40" strokeWidth="9"/>
      <ellipse cx="1028" cy="508" rx="28" ry="47" fill="#647c91" stroke="#121c2a" strokeWidth="5"/>
      {/* Coupe/sedan upper fender metal and rear haunch. */}
      <path d={'M205 452Q240 423 346 418L411 407L428 '+(rearRoof+26)+' '+roof.slice(1)+
          ' Q892 338 1003 388L1114 428Q1148 442 1144 483L1113 533Q1080 556 992 567L322 554Q232 547 205 521Z'}
        fill={g('paintSide')} stroke={deep} strokeWidth="4" strokeLinejoin="round"/>
      {/* The hood stays one clean shaped uninterrupted metal panel. */}
      <path d="M668 395Q778 361 866 360Q970 370 1111 429L1116 460Q1000 435 858 440L704 428Z"
        fill={g('paintTop')} stroke={light} strokeOpacity=".40" strokeWidth="1.7"/>
      <path d="M684 407Q853 368 1034 419" fill="none" stroke="#d5e8ed" strokeOpacity=".38" strokeWidth="4" strokeLinecap="round"/>
      {/* Cabin roof with rounded A/B/C pillar structure. */}
      <path d={roof+' L835 352Q733 332 652 325L448 366Z'}
        fill={g('roof')} stroke="#a4bbcb" strokeOpacity=".53" strokeWidth="2.2"/>
      <path d={glass} fill={g('glass')} stroke="#a9d3de" strokeWidth="4" strokeOpacity=".9"/>
      <g clipPath={g('glassClip')}>
        <path d="M430 335L746 268L765 298L460 386Z" fill="#d1eef6" opacity=".15"/>
        <path d="M485 311L526 304L589 405L544 397Z" fill="#f6ffff" opacity=".10"/>
        <path d="M698 282L725 298L763 390L741 391Z" fill="#d2edf5" opacity=".12"/>
        <path d="M647 303L679 397" stroke="#071322" strokeWidth="10"/>
        <path d="M477 355L791 345" stroke="#d8faff" strokeOpacity=".14" strokeWidth="3"/>
        <path d="M462 382L665 401L812 354" fill="none" stroke="#0b1c2b" strokeOpacity=".70" strokeWidth="10"/>
      </g>
      {/* Bodyside 'S' sculpture, refined shut lines and physical handles. */}
      <path d="M274 467Q475 448 659 454Q825 442 976 464"
        fill="none" stroke={light} strokeWidth="7" strokeOpacity=".26" strokeLinecap="round"/>
      <path d="M288 475Q479 468 687 478Q864 467 983 478" fill="none" stroke="#f4faff" strokeOpacity=".12" strokeWidth="2.4"/>
      <path d="M280 524Q472 527 666 532L974 538" stroke="#081522" strokeOpacity=".48" strokeWidth="6" fill="none"/>
      <path d="M468 400L462 491Q459 512 474 545" stroke="#08131f" strokeWidth="3" strokeOpacity=".62" fill="none"/>
      <path d="M663 403L681 533" stroke="#0a1524" strokeWidth="2.9" strokeOpacity=".64" fill="none"/>
      <path d="M737 463L779 457" stroke="#d3dfe3" strokeWidth="6" strokeLinecap="round"/>
      <path d="M481 469L519 464" stroke="#d3dfe3" strokeWidth="6" strokeLinecap="round"/>
      <path d="M738 464L779 458" stroke="#172435" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M481 470L519 466" stroke="#172435" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Sculpted carbon sill above shadow. */}
      <path d="M290 542Q554 555 935 548L960 568Q648 580 334 561Z" fill="#111d29" stroke="#557086" strokeWidth="1.5"/>
      <path d="M303 545Q638 557 950 552" fill="none" stroke="#c9e1e6" strokeOpacity=".26" strokeWidth="2"/>
      {/* 3-D projecting mirror with metallic cap and stalk. */}
      <path d="M738 399l46-10 16 10-15 10-41-1Z" fill="#1b2839"/>
      <path d="M761 392Q794 382 823 398L802 407L768 410Z" fill={g('paintTop')} stroke={light} strokeWidth="2"/>
      <path d="M775 397l35 3" stroke="#d9e7ed" strokeWidth="3" strokeOpacity=".55"/>
      {/* Front nose with angular-to-elliptic front fascia transitions. */}
      <path d="M975 452Q1077 430 1138 460L1144 486Q1136 523 1113 535L993 556Q1014 519 975 452Z"
        fill={g('paintNose')} stroke={deep} strokeWidth="3.5"/>
      <path d="M991 472Q1083 452 1135 479L1124 516Q1059 535 1003 537Z"
        fill="#0a1523" stroke="#7f9daf" strokeWidth="2"/>
      <path d="M1002 484Q1091 464 1126 485L1119 508Q1060 524 1010 523Z"
        fill="#09121e" stroke="#1e3247" strokeWidth="2"/>
      {Array.from({length:14},(_,i)=> <path key={i} d={'M'+(1012+i*8)+' '+(488-i*.19)+
        'l'+(i<7?-4:4)+' '+(29-i*.35)}
        stroke={i%2===0?'#4a5b68':'#233846'} strokeWidth="3.4" opacity=".95"/>)}
      {/* Layered matrix headlamp and swept DRL. */}
      <path d="M960 426Q1022 416 1076 438L1097 454Q1045 452 984 447Z"
        fill={g('lamp')} stroke="#d9e9f2" strokeOpacity=".6" strokeWidth="2"/>
      <path d="M978 437Q1010 426 1078 443L1092 453Q1038 443 992 445"
        fill="none" stroke="#e7f9ff" strokeWidth="5" strokeLinecap="round"/>
      {[1005,1030,1055].map((x,i)=><g key={x}>
        <path d={'M'+x+' '+(431+i*.3)+'l6 3-5 7-9-2Z'} fill="#bceeff" stroke="#ffffff" strokeWidth="1.1"/>
        <ellipse cx={x+4} cy={437+i*.1} rx={15} ry={12} fill={g('headlight')} opacity=".62"/>
      </g>)}
      <path d="M1099 468L1132 479L1127 493L1101 487Z" fill="#162538" stroke="#798fa7" strokeWidth="2"/>
      <path d="M1102 474L1127 481" stroke="#bcdfe8" strokeOpacity=".6" strokeWidth="3"/>
      <path d="M1112 519L1140 492L1125 526L1090 544Z" fill="#111b2a" stroke="#61778b" strokeWidth="2"/>
      <path d="M1115 519l18-17" stroke="#b3c3cc" strokeOpacity=".45" strokeWidth="2"/>
      {/* Rear LED light wraps around the paint shoulder. */}
      <path d="M212 455Q236 444 263 444L278 451Q249 466 211 465Z" fill="#541922"/>
      <path d="M210 452Q248 440 270 446" stroke="#fa8a7c" strokeWidth="6" strokeLinecap="round"/>
      <path d="M216 461L243 458" stroke="#ff5d64" strokeWidth="2.5"/>
      {/* Proper arches: black carbon inner lining, far outer metal shadow. */}
      <path d="M287 534Q285 465 352 457Q414 456 421 539" fill="none" stroke="#131d2a" strokeWidth="22"/>
      <path d="M810 547Q799 473 868 461Q943 453 963 542" fill="none" stroke="#121a25" strokeWidth="25"/>
      <ForgedWheel x={354} y={523} r={wheelSize*.90} skinny tint="#af593c"/>
      <ForgedWheel x={871} y={541} r={wheelSize} tint="#c57c41"/>
      {/* Body overarches retain the upper lip, not a cut-and-paste wheel. */}
      <path d="M292 528Q288 466 350 459Q414 457 418 537" fill="none" stroke={dark} strokeWidth="6"/>
      <path d="M809 545Q799 478 866 465Q934 459 959 541" fill="none" stroke={dark} strokeWidth="7"/>
      <path d="M301 500Q321 460 365 464" stroke="#c6e2e4" opacity=".24" strokeWidth="3" fill="none"/>
      <path d="M816 512Q836 461 885 467" stroke="#dcebed" opacity=".26" strokeWidth="3" fill="none"/>
      <path d="M978 551Q1070 550 1130 518" fill="none" stroke="#081724" strokeWidth="8"/>
      {/* Controlled specular panel reflection, not an over-bright white stripe. */}
      <path d="M349 435Q565 411 780 426Q868 427 955 449" stroke="#eefaff" opacity=".12" strokeWidth="9" fill="none"/>
    </g>
    <g opacity=".18">
      <path d="M292 641Q610 684 1074 628" stroke="#a9cce1" strokeWidth="2" fill="none"/>
      <path d="M386 660Q672 696 947 657" stroke="#e0ecec" strokeWidth="3" fill="none"/>
    </g>
    {!compact && <g>
      <rect x="28" y="34" width="128" height="29" rx="14" fill="#102132" stroke="#8299a7" strokeOpacity=".55"/>
      <circle cx="49" cy="49" r="5" fill="#82d7cb"/>
      <text x="65" y="53" fill="#c6d9e5" fontSize="12" fontFamily="sans-serif" letterSpacing="2.3">2D STUDIO</text>
    </g>}
  </svg>;
});
