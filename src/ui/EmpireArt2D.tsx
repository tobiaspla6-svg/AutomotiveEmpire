import type { EngineLayout } from '../sim/types';

/** Native 2D SVG art: no WebGL, 3D binaries, downloaded images or brand trademarks. */
export function CampusArt2D() {
  return (
    <svg className="ae-campus-svg" viewBox="0 0 1000 460" role="img" aria-label="Illustrated automotive headquarters with design studio, assembly plant and dealership">
      <defs>
        <linearGradient id="ae-sky" x2="0" y2="1"><stop stopColor="#101f39"/><stop offset=".62" stopColor="#243959"/><stop offset="1" stopColor="#5b5160"/></linearGradient>
        <linearGradient id="ae-street" x2="0" y2="1"><stop stopColor="#405167"/><stop offset="1" stopColor="#1d2739"/></linearGradient>
        <linearGradient id="ae-wall" x2="0" y2="1"><stop stopColor="#b2c6d8"/><stop offset="1" stopColor="#657b97"/></linearGradient>
        <linearGradient id="ae-roof" x2="0" y2="1"><stop stopColor="#f9c176"/><stop offset="1" stopColor="#b56d56"/></linearGradient>
        <linearGradient id="ae-glass" x2="0" y2="1"><stop stopColor="#66c4d9"/><stop offset="1" stopColor="#193b63"/></linearGradient>
        <filter id="ae-glow"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      <path d="M0 0H1000V460H0Z" fill="url(#ae-sky)"/>
      <circle cx="784" cy="91" r="54" fill="#f9bd9b" opacity=".19" filter="url(#ae-glow)"/>
      <circle cx="784" cy="91" r="34" fill="#ffd8b3" opacity=".69"/>
      {Array.from({length:20},(_,i)=><rect key={i} x={i*53} y={174+(i%4)*14} width={35} height={144-(i%4)*14} fill="#1e3049" opacity=".74"/>)}
      <path d="M0 285Q270 257 506 300T1000 285V460H0Z" fill="#31495b"/>
      <path d="M0 354L475 285L1000 347V460H0Z" fill="url(#ae-street)"/>
      <path d="M0 430L489 323L1000 414" fill="none" stroke="#f1d59d" strokeWidth="3" opacity=".37" strokeDasharray="25 24"/>
      <g className="ae-art-hq">
        <path d="M56 174L230 128L356 166L183 211Z" fill="#bcd2e2"/>
        <path d="M56 174L183 211V354L56 313Z" fill="#607996"/>
        <path d="M183 211L356 166V313L183 354Z" fill="url(#ae-wall)"/>
        <path d="M57 174L229 126L356 167L183 211Z" fill="#ddedec" opacity=".7"/>
        {Array.from({length:4},(_,i)=><g key={i}><path d={'M'+(201+i*35)+' '+(216-i*9)+'l27 -7v44l-27 7z'} fill="url(#ae-glass)" stroke="#d2edf7" strokeWidth="2"/><path d={'M'+(201+i*35)+' '+(275-i*9)+'l27 -7v44l-27 7z'} fill="url(#ae-glass)" stroke="#d2edf7" strokeWidth="2"/></g>)}
        <path d="M90 220L139 236V273L90 258Z" fill="#183c5c" stroke="#bfd0df" strokeWidth="3"/>
        <path d="M90 283L139 298V331L90 316Z" fill="#183c5c" stroke="#bfd0df" strokeWidth="3"/>
        <path d="M227 346v-57l39-10v58Z" fill="#1e364d"/>
        <path d="M227 289l39-10" stroke="#f8c78a" strokeWidth="5"/>
        <path d="M112 167L218 140L298 162L194 189Z" fill="#fff6d5" opacity=".19"/>
        <path d="M153 131h83" stroke="#ffd293" strokeWidth="4" strokeLinecap="round"/>
      </g>
      <g className="ae-art-factory">
        <path d="M376 238l226-71 226 58-229 80z" fill="#a7b9c9"/>
        <path d="M376 238l223 67v110l-223-61z" fill="#536881"/>
        <path d="M599 305l229-80v124l-229 66z" fill="#9aaec0"/>
        <path d="M391 240l115-37 116 33-117 34z" fill="url(#ae-roof)"/>
        <path d="M508 202l105-33 118 33-109 35z" fill="#d6a377"/>
        <path d="M651 179v-77l43-14v88" fill="#667689" stroke="#b7c9d6" strokeWidth="3"/>
        <path d="M729 199v-70l32-12v93" fill="#697e8f" stroke="#b7c9d6" strokeWidth="3"/>
        <path d="M645 105q-20-16-4-26q8-15-9-24" fill="none" stroke="#d5e4df" strokeWidth="9" opacity=".17" strokeLinecap="round"/>
        {Array.from({length:5},(_,i)=><path key={i} d={'M'+(387+i*42)+' '+(270+i*12)+'l29 8v43l-29-8z'} fill="#214765" stroke="#8ec1d3" strokeWidth="2"/>)}
        <path d="M639 319l151-47v86l-151 44z" fill="#213e53" stroke="#9ab3be" strokeWidth="3"/>
        <path d="M651 333l128-38m-128 61l128-38m-128 61l128-38" stroke="#59758a" strokeWidth="5"/>
        <path d="M463 236l40 12" stroke="#fff0c4" strokeWidth="5"/>
      </g>
      <g className="ae-art-showroom">
        <path d="M738 304l122-34 102 34-119 37z" fill="#d9e0dc"/>
        <path d="M738 304l105 37v73l-105-29z" fill="#58788d"/>
        <path d="M843 341l119-37v76l-119 34z" fill="url(#ae-glass)" stroke="#9cd2e2" strokeWidth="2"/>
        <path d="M754 330l68 21v44l-68-19z" fill="url(#ae-glass)" stroke="#9dd6e3" strokeWidth="2"/>
        <path d="M843 363l113-35" stroke="#b5e7f2" strokeWidth="4"/>
        <path d="M760 283l99-28 106 36-107 31z" fill="#e4b881"/>
        <path d="M818 377q14-12 28-11h30q23-11 38-7l22 8v12h-118z" fill="#fce1a2"/>
        <circle cx="842" cy="380" r="10" fill="#14253a" stroke="#b6d6e0" strokeWidth="3"/>
        <circle cx="916" cy="380" r="10" fill="#14253a" stroke="#b6d6e0" strokeWidth="3"/>
      </g>
      <path d="M0 429Q110 394 193 405T413 423" fill="none" stroke="#d0d3d4" opacity=".18" strokeWidth="7"/>
      <g transform="translate(316 367)">
        <ellipse cx="51" cy="24" rx="92" ry="11" fill="#0a1826" opacity=".3"/>
        <path d="M-32 12L-15 4L5-1Q33-23 65-16L93-1L131 10Q142 15 142 24H-39Q-41 17-32 12" fill="#f3c269" stroke="#ffe2a6" strokeWidth="2"/>
        <path d="M16 0q17-16 41-14l24 13Z" fill="#264c64"/>
        {[0,110].map(v=><g key={v}><circle cx={v} cy="23" r="16" fill="#162333"/><circle cx={v} cy="23" r="9" fill="#b9d3da"/><circle cx={v} cy="23" r="4" fill="#233e57"/></g>)}
      </g>
    </svg>
  );
}

export function EngineArt2D({layout='I4'}:{layout?:EngineLayout}) {
  const count=layout==='EV'?0:parseInt(layout.replace(/\D/g,''),10)||4;
  const banked=layout.startsWith('V')||layout.startsWith('F');
  const n=Math.min(12,count);
  return (
    <svg className="ae-engine-svg" viewBox="0 0 440 255" role="img" aria-label={'2D technical illustration of '+layout+' powertrain'}>
      <defs><linearGradient id="ae-eng-metal" x2="1" y2="1"><stop stopColor="#7ea3b8"/><stop offset=".45" stopColor="#263b55"/><stop offset="1" stopColor="#9cb9c5"/></linearGradient></defs>
      <ellipse cx="220" cy="219" rx="153" ry="14" fill="#020a13" opacity=".6"/>
      <path d="M107 76L342 76L375 184L322 222H123L71 183Z" fill="url(#ae-eng-metal)" stroke="#95c1d1" strokeWidth="3"/>
      {layout==='EV'?(
        <g><rect x="136" y="94" width="170" height="95" rx="23" fill="#153c55" stroke="#74e0cf" strokeWidth="5"/><circle cx="221" cy="141" r="48" fill="#152d40" stroke="#91dfe8" strokeWidth="8"/>{Array.from({length:9},(_,i)=><path key={i} d="M220 112v-28" stroke="#78d6e0" strokeWidth="5" transform={'rotate('+(i*40)+' 221 141)'}/>)}</g>
      ):(
        <g>
          <path d={banked?'M113 74L211 44L221 146L121 170Z':'M141 63L309 63L319 171H128Z'} fill="#101f31" stroke="#bcced5" strokeWidth="5"/>
          {Array.from({length:n},(_,i)=>{
            const col=banked?i%2:i%4;
            const row=banked?Math.floor(i/2):Math.floor(i/4);
            const x=banked?(i%2?255:177)+(row-1.5)*10:159+col*43;
            const y=banked?83+row*18:84+row*47;
            return <g key={i}><rect x={x-12} y={y-8} width="25" height="30" rx="7" transform={banked?'rotate('+(i%2?22:-22)+' '+x+' '+y+')':undefined} fill="#738ea4" stroke="#d3e0df" strokeWidth="2"/><circle cx={x} cy={y+7} r="5" fill="#172a3e"/></g>;
          })}
          <rect x="158" y="53" width="124" height="28" rx="12" fill="#18283c" stroke="#d1dadb" strokeWidth="3"/>
        </g>
      )}
      <g><circle cx="128" cy="194" r="23" fill="#0c1b2b" stroke="#e0c590" strokeWidth="5"/><circle cx="310" cy="195" r="29" fill="#0c1b2b" stroke="#d2c8a9" strokeWidth="5"/><circle cx="310" cy="195" r="11" fill="#667e96"/><path d="M128 174L310 170M128 216L310 225" fill="none" stroke="#18232e" strokeWidth="10"/></g>
      <text x="220" y="21" textAnchor="middle" fontSize="17" fill="#c2d5e1" fontWeight="700" letterSpacing="4">{layout==='EV'?'ELECTRIC':layout+' POWERTRAIN'}</text>
    </svg>
  );
}

export function ChestArt2D({opened=false}:{opened?:boolean}) {
  return (
    <svg className={'ae-chest-art '+(opened?'ae-chest-open':'')} viewBox="0 0 270 220" role="img" aria-label={opened?'Opened treasure chest':'Blueprint reward chest'}>
      <defs><linearGradient id="ae-ch-gold" x2="1" y2="1"><stop stopColor="#ffe2a1"/><stop offset="1" stopColor="#b67b37"/></linearGradient></defs>
      <ellipse cx="135" cy="193" rx="90" ry="15" fill="#050e19" opacity=".5"/>
      <g className="ae-chest-lid"><path d="M45 92Q46 33 135 25Q228 30 225 92V118H45Z" fill="#29445f" stroke="#ffe0a5" strokeWidth="9"/><path d="M66 88Q82 49 137 49Q193 54 203 88Z" fill="#4c6b86"/><path d="M132 35V112" stroke="#eac888" strokeWidth="9"/></g>
      <path d="M42 101L228 101L214 183Q135 206 56 183Z" fill="#263d59" stroke="url(#ae-ch-gold)" strokeWidth="9"/>
      <path d="M135 108V194M58 156L210 156" stroke="#d0a86c" strokeWidth="9"/>
      <rect x="116" y="122" width="38" height="45" rx="7" fill="#e4c58d" stroke="#ffe6b7" strokeWidth="4"/>
      <path d="M128 140q6-12 13 0l-4 9v8h-7v-8z" fill="#344358"/>
      {opened&&<g><path d="M135 5L135 80M76 26L107 79M197 24L160 77" stroke="#f9d991" strokeWidth="5" strokeLinecap="round"/></g>}
    </svg>
  );
}
