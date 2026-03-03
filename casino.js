// ─── STATE ────────────────────────────────────────────────────────────────────
var BAL=parseInt(localStorage.getItem('bal')||'1000000');
var SPIN=false,cfSel=0,rSel=37,depAmt=100000;
var slip=[],liveEvs=[],curSport='soccer';
var RWHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
var RREDS=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
var rWheelAngle=0,rBallAngle=0,rBallR=0,rAnimId=null,rSpinning=false,rCanvas,rCtx,rWinIdx=-1,rAudioCtx=null;
var recentWins=[];
var GAME_NAMES={cfr:'Coin Flip',bjr:'Blackjack',dcr:'Dice',crr:'Crash',ror:'Roulette',pkr:'Plinko',slr:'Slots',mnr:'Mines'};
var crState='idle',crMult=1,crTarget=1,crBet=0,crStart=0,crAnimId=null,crCanvas,crCtx;
var crHistory=[];
var pkCanvas,pkCtx,pkAnimId=null,PKROWS=16,pkRisk='low',pkBallsN=1,pkActiveBalls=[];
var pkDropPending=0,pkDropProfit=0,pkDropCost=0;
var PKMULTS={
  8:{low:[5.6,2.1,1.1,1.0,0.5,1.0,1.1,2.1,5.6],med:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],high:[29,4,1.5,0.3,0.2,0.3,1.5,4,29]},
  10:{low:[8.9,3,1.4,1.1,1.0,0.5,1.0,1.1,1.4,3,8.9],med:[22,5,2,1.4,0.6,0.4,0.6,1.4,2,5,22],high:[76,10,3,0.9,0.3,0.2,0.3,0.9,3,10,76]},
  12:{low:[10,3,1.6,1.4,1.1,1.0,0.5,1.0,1.1,1.4,1.6,3,10],med:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],high:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170]},
  16:{low:[16,9,2,1.4,1.4,1.2,1.1,1.0,0.5,1.0,1.1,1.2,1.4,1.4,2,9,16],med:[110,41,10,5,3,1.5,1.0,0.5,0.3,0.5,1.0,1.5,3,5,10,41,110],high:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}
};
var _catSVG='<img src="https://creator-hub-prod.s3.us-east-2.amazonaws.com/ord-motocats_pfp_1754578871657.png" width="58" height="58" style="object-fit:cover;border-radius:8px">';
var _opSVG='<img src="https://unavatar.io/twitter/opnetbtc" width="58" height="58" style="object-fit:cover;border-radius:8px">';
var _pillSVG='<img src="https://unavatar.io/twitter/orangepillonbtc" width="58" height="58" style="object-fit:cover;border-radius:8px">';
var SSYMS=['₿',_catSVG,_opSVG,'♦',_pillSVG,'★'],SNAMES=['₿','🐱','OP','♦','🟠','★'],SCLS=['sc-btc','sc-cat','sc-sol','sc-usd','sc-pill','sc-star'],SPAY=[[10,50,200],[6,25,100],[4,15,50],[3,10,30],[2,6,20],[1,3,10]],slSpinning=false,slAmbId=null;
var mnActive=false,mnGrid=[],mnMines=3,mnRevealed=0,mnBet=0;
var bjDeck=[],bjPlayer=[],bjDealer=[],bjBet=0,bjState='idle';
var dThresh=50,dOver=true;

// ─── FULLSCREEN OVERLAY ───────────────────────────────────────────────────────
(function(){
var css='#fsov{position:fixed;inset:0;z-index:300;background:#0a0b0f;display:none;flex-direction:column;font-family:"Segoe UI",system-ui,sans-serif;color:#e5e7eb}'
+'#fsov.on{display:flex}'
+'.fsh{height:54px;background:#0e0f1a;border-bottom:1px solid #1e1f30;display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0}'
+'.fscls{margin-left:auto;background:#131420;border:1px solid #1e1f30;color:#6b7280;padding:7px 16px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:700;transition:.15s}'
+'.fscls:hover{color:#f7931a;border-color:#f7931a}'
+'.fsb{flex:1;display:flex;min-height:0;overflow:hidden}'
+'.fsM{flex:1;display:flex;align-items:center;justify-content:center;padding:14px;min-height:0;overflow:hidden}'
+'.fsC{width:290px;background:#0e0f1a;border-left:1px solid #1e1f30;padding:16px;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;gap:10px}'
+'input.dsl{-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:4px;outline:none;cursor:pointer;background:linear-gradient(90deg,#ef4444,#10b981);margin:4px 0}'
+'input.dsl::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#f7931a;cursor:pointer;border:3px solid #fff;box-shadow:0 2px 8px rgba(247,147,26,.5)}'
+'.dtog{display:flex;border-radius:8px;border:1px solid #1e1f30;overflow:hidden}'
+'.dtt{flex:1;padding:11px;text-align:center;cursor:pointer;font-size:13px;font-weight:700;color:#6b7280;background:#131420;transition:.15s}'
+'.dtt.on{background:rgba(247,147,26,.2);color:#f7931a}'
+'.dnum{font-size:88px;font-weight:900;text-align:center;line-height:1;transition:color .2s;font-variant-numeric:tabular-nums;padding:16px 0}'
+'.bjtbl{background:radial-gradient(ellipse at 50% 35%,#0d5c3e,#022c22);border-radius:20px;padding:20px 24px;border:3px solid #065f46;width:100%;height:100%;display:flex;flex-direction:column;gap:10px;box-shadow:inset 0 0 60px rgba(0,0,0,.5)}'
+'.bjzone{flex:1;display:flex;flex-direction:column;justify-content:space-between}'
+'.bjlb2{font-size:11px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.1em;display:flex;align-items:center;gap:8px;text-transform:uppercase}'
+'.bjsc2{font-size:22px;font-weight:900;color:#fff}'
+'.bjrow{display:flex;gap:8px;flex-wrap:wrap;min-height:90px;align-items:center}'
+'.card2{width:76px;height:110px;background:#fff;border-radius:10px;box-shadow:3px 5px 18px rgba(0,0,0,.7);position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;animation:cIn .3s ease backwards}'
+'.card2.r{color:#dc2626}.card2.b{color:#111827}'
+'.c2r{position:absolute;top:5px;left:7px;font-size:13px;font-weight:900;line-height:1.2}'
+'.c2s{font-size:34px;line-height:1}'
+'.c2b{position:absolute;bottom:5px;right:7px;font-size:13px;font-weight:900;transform:rotate(180deg);line-height:1.2}'
+'.card2.fd{background:repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a 8px,#1e40af 8px,#1e40af 16px)}'
+'@keyframes cIn{from{opacity:0;transform:translateY(-24px) scale(.75)}to{opacity:1;transform:none}}'
+'.mn3g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(100%,440px);aspect-ratio:1}'
+'.mt3{cursor:pointer;perspective:600px;aspect-ratio:1}'
+'.mt3-in{width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.4,0,.2,1);border-radius:12px;position:relative}'
+'.mt3.flp .mt3-in{transform:rotateY(180deg)}'
+'.mt3-f,.mt3-b{position:absolute;inset:0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;backface-visibility:hidden;border:2px solid #2a2b40;background:#1e1f30;transition:background .12s,border-color .12s}'
+'.mt3.act .mt3-f:hover{background:#262740;border-color:#f7931a;box-shadow:0 0 14px rgba(247,147,26,.25)}'
+'.mt3-b{transform:rotateY(180deg);background:#0e0f1a}'
+'.mt3-b.gem{background:rgba(16,185,129,.15);border-color:#10b981;box-shadow:0 0 16px rgba(16,185,129,.25)}'
+'.mt3-b.bomb{background:rgba(239,68,68,.15);border-color:#ef4444;box-shadow:0 0 16px rgba(239,68,68,.25)}'
+'.mnMult{font-size:52px;font-weight:900;text-align:center;color:#f7931a;text-shadow:0 0 24px rgba(247,147,26,.45);line-height:1}'
+'#crfull{width:100%;height:100%;display:flex;flex-direction:column;gap:6px}'
+'#crfull canvas{flex:1;min-height:0;border-radius:10px;border:1px solid #1e1f30;display:block}'
+'#crmult2{font-size:68px;font-weight:900;text-align:center;line-height:1;transition:color .1s;padding:4px 0}'
+'.crh2{display:flex;gap:5px;flex-wrap:wrap;min-height:26px}'
+'#pkfull{width:100%;height:100%;display:flex;align-items:center;justify-content:center}'
+'#pkfull canvas{max-height:100%;max-width:100%;border-radius:10px;border:1px solid #1e1f30}'
// ── FESTIVE EXTRAS
+'@keyframes bpulse{0%,100%{transform:translateY(0);box-shadow:0 4px 20px rgba(247,147,26,.35)}50%{transform:translateY(-2px);box-shadow:0 8px 42px rgba(247,147,26,.7),0 0 80px rgba(247,147,26,.15)}}'
+'.bplay{animation:bpulse 2.2s ease-in-out infinite}'
+'@keyframes goldGlow{0%,100%{text-shadow:0 0 14px rgba(247,147,26,.5),0 0 30px rgba(247,147,26,.2)}50%{text-shadow:0 0 32px rgba(247,147,26,1),0 0 70px rgba(247,147,26,.45),0 0 120px rgba(247,147,26,.15)}}'
+'.mnMult{animation:goldGlow 2s ease-in-out infinite}'
+'#crmult2{animation:goldGlow 2s ease-in-out infinite}'
+'@keyframes gemSpark{0%,100%{box-shadow:0 0 18px rgba(16,185,129,.35),inset 0 0 10px rgba(16,185,129,.1)}50%{box-shadow:0 0 36px rgba(16,185,129,.8),inset 0 0 22px rgba(16,185,129,.3),0 0 60px rgba(16,185,129,.15)}}'
+'.mt3-b.gem{animation:gemSpark 1.4s ease-in-out infinite!important}'
+'@keyframes payFlash{0%,100%{opacity:.7;box-shadow:none}50%{opacity:1;box-shadow:0 0 22px rgba(247,147,26,.75),0 0 50px rgba(247,147,26,.2)}}'
+'.spayline{animation:payFlash 1.5s ease-in-out infinite!important}'
+'@keyframes resIn{0%{opacity:0;transform:scale(.9) translateY(8px)}100%{opacity:1;transform:none}}'
+'.res.w,.res.l{animation:resIn .35s cubic-bezier(.175,.885,.32,1.275)}'
+'.dnum{border-radius:20px;border:2px solid rgba(247,147,26,.25);margin:0 16px;background:linear-gradient(135deg,#0f0f1e,#1a0a00);box-shadow:inset 0 0 50px rgba(247,147,26,.06),0 0 40px rgba(247,147,26,.1)}'
+'.fsh{background:linear-gradient(135deg,#12111e 0%,#1e0e00 100%)!important;border-bottom:2px solid rgba(247,147,26,.45)!important}'
+'.fsM{background:radial-gradient(ellipse at 30% 60%,#0e0e22 0%,#0a0b0f 65%)!important}'
+'.fsC{background:linear-gradient(180deg,#0f1020,#0a0c14)!important;border-left:1px solid rgba(247,147,26,.18)!important}'
+'@keyframes tileHint{0%,100%{border-color:#2a2b40}50%{border-color:rgba(247,147,26,.4);box-shadow:0 0 12px rgba(247,147,26,.12)}}'
+'.mt3.act .mt3-f{animation:tileHint 2.8s ease-in-out infinite}'
+'.mt3.act .mt3-f:hover{animation:none;background:#262740;border-color:#f7931a;box-shadow:0 0 20px rgba(247,147,26,.4)!important}'
+'@keyframes wbPop{0%{opacity:0;transform:scale(.65)}65%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}'
+'.wbox{animation:wbPop .4s cubic-bezier(.175,.885,.32,1.275)}'
+'@keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}'
+'.wtit{background:linear-gradient(270deg,#f7931a,#fbbf24,#10b981,#06b6d4,#f7931a);background-size:400% 400%;animation:gradShift 3s ease infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent}'
+'.gc{transition:transform .2s,box-shadow .2s!important}'
+'.gc:hover{transform:scale(1.06)!important;box-shadow:0 0 0 2px rgba(247,147,26,.65),0 18px 54px rgba(247,147,26,.28)!important}'
+'@keyframes dttPulse{0%,100%{background:rgba(247,147,26,.2)}50%{background:rgba(247,147,26,.38)}}'
+'.dtt.on{animation:dttPulse 2s ease-in-out infinite}'
+'@keyframes coinGlow{0%,100%{filter:drop-shadow(0 0 8px rgba(247,147,26,.35))}50%{filter:drop-shadow(0 0 24px rgba(247,147,26,.8))}}'
+'.cf.ch{animation:coinGlow 2.2s ease-in-out infinite}'
+'@keyframes rbGlow{0%,100%{box-shadow:0 0 30px rgba(247,147,26,.2)}50%{box-shadow:0 0 60px rgba(247,147,26,.5)}}'
+'#roul-cv{animation:rbGlow 3s ease-in-out infinite}'
+'@keyframes rainbowBorder{0%{border-color:rgba(247,147,26,.4)}25%{border-color:rgba(251,191,36,.5)}50%{border-color:rgba(16,185,129,.4)}75%{border-color:rgba(6,182,212,.4)}100%{border-color:rgba(247,147,26,.4)}}'
+'.bjtbl{animation:rainbowBorder 4s linear infinite!important}'
+'@keyframes topBar{0%{background-position:0% 50%}100%{background-position:200% 50%}}'
+'.fs-topbar{height:4px;background:linear-gradient(90deg,#f7931a,#fbbf24,#10b981,#06b6d4,#a855f7,#ef4444,#f7931a);background-size:300% 100%;animation:topBar 3s linear infinite;flex-shrink:0}';
var s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
// Extra CSS for main page
var s2=document.createElement('style');
s2.textContent='.gg{padding-bottom:6px}'
+'.gc{box-shadow:0 4px 20px rgba(0,0,0,.4)}'
+'.gbg{font-size:56px!important;transition:transform .3s}'
+'.gc:hover .gbg{transform:scale(1.15)}'
+'.gtit{font-size:13px;font-weight:800;background:linear-gradient(90deg,#f7931a,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:.08em;text-transform:uppercase}'
+'@keyframes hotBadge{0%,100%{background:#ef4444}50%{background:#dc2626;box-shadow:0 0 10px rgba(239,68,68,.5)}}'
+'.hot{animation:hotBadge 1.8s ease-in-out infinite}'
+'@keyframes newBadge{0%,100%{background:#10b981}50%{background:#059669;box-shadow:0 0 10px rgba(16,185,129,.5)}}'
+'.new{animation:newBadge 1.8s ease-in-out infinite}'
+'.logo{font-size:22px!important}'
+'.bsat{animation:goldGlow 3s ease-in-out infinite}'
+'.dbtn{animation:bpulse 2.5s ease-in-out infinite}'
// ── Roulette felt table
+'.rfelt{background:linear-gradient(150deg,#1b5c38,#0e3d24,#1b5c38);border:2px solid rgba(255,255,255,.13);border-radius:14px;padding:10px 12px;box-shadow:inset 0 0 60px rgba(0,0,0,.4),0 0 40px rgba(0,80,20,.2)}'
+'.rtnum{flex:1;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;border-radius:5px;border:1px solid rgba(255,255,255,.18);cursor:pointer;transition:transform .1s,box-shadow .1s;min-width:0;min-height:28px;user-select:none}'
+'.rtnum:hover{transform:scale(1.1);z-index:2;box-shadow:0 0 10px rgba(251,191,36,.5)!important}'
+'.rtnum.on{outline:2px solid #fbbf24;box-shadow:0 0 14px rgba(251,191,36,.6)!important;transform:scale(1.08)}'
+'.rtnum.nr{background:#c0392b;color:#fff}'
+'.rtnum.nb{background:#1c1c30;color:#fff}'
+'.rtnum.ng{background:#15803d;color:#fff}'
+'.rt0{background:#15803d;color:#fff;font-size:18px;font-weight:900;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:36px;border:1px solid rgba(255,255,255,.25);transition:.12s;user-select:none}'
+'.rt0:hover,.rt0.on{outline:2px solid #fbbf24;box-shadow:0 0 16px rgba(251,191,36,.55)}'
+'.rout{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:5px;color:#e5e7eb;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:7px 4px;text-align:center;transition:.12s;letter-spacing:.04em;user-select:none}'
+'.rout:hover{background:rgba(251,191,36,.15);border-color:rgba(251,191,36,.6);color:#fbbf24}'
+'.rout.on{background:rgba(251,191,36,.22);border-color:#fbbf24;color:#fbbf24;box-shadow:0 0 10px rgba(251,191,36,.3)}'
+'.rout.red-b{background:rgba(192,57,43,.18);border-color:rgba(239,68,68,.45)}'
+'.rout.red-b.on{background:rgba(192,57,43,.4);border-color:#ef4444}'
+'.rout.blk-b{background:rgba(28,28,50,.45);border-color:rgba(255,255,255,.25)}'
+'.r21btn{flex:1;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:5px;color:#9ca3af;font-size:11px;font-weight:800;cursor:pointer;transition:.12s;user-select:none}'
+'.r21btn:hover,.r21btn.on{background:rgba(251,191,36,.15);border-color:#fbbf24;color:#fbbf24}'
// ── SLOTS ARCADE UPGRADE
+'@keyframes ledBlink{0%,49%{opacity:1}50%,100%{opacity:.55}}'
+'@keyframes neonFlicker{0%,19%,21%,23%,25%,54%,56%,100%{box-shadow:0 0 4px #f7931a,0 0 16px #f7931a,0 0 38px rgba(247,147,26,.5),inset 0 0 8px rgba(247,147,26,.15)}20%,24%,55%{box-shadow:none}}'
+'@keyframes reelGlow{0%,100%{box-shadow:0 0 12px rgba(247,147,26,.25),inset 0 0 14px rgba(0,0,0,.7)}50%{box-shadow:0 0 28px rgba(247,147,26,.55),inset 0 0 14px rgba(0,0,0,.7)}}'
+'.smach{background:linear-gradient(160deg,#1c0060 0%,#0a0028 40%,#1c0060 100%)!important;border:3px solid #f7931a!important;animation:neonFlicker 8s infinite!important;box-shadow:0 0 40px rgba(247,147,26,.3),inset 0 0 30px rgba(0,0,20,.8)!important}'
+'.smtop{font-size:14px!important;letter-spacing:.25em!important;animation:ledBlink 1.1s step-end infinite;background:linear-gradient(90deg,#f7931a,#fbbf24,#f7931a);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent}'
+'.sreels{background:#000!important;border:3px solid rgba(247,147,26,.8)!important;border-radius:12px!important;padding:6px!important;animation:reelGlow 2.5s ease-in-out infinite!important;display:flex!important;gap:6px!important;position:relative!important}'
+'.srcol{background:linear-gradient(180deg,#0a000a,#1a0030,#0a000a)!important;border:2px solid rgba(168,85,247,.4)!important;border-radius:8px!important;width:76px!important;height:240px!important;overflow:hidden!important;position:relative!important;flex-shrink:0!important}'
+'.srtrack{position:absolute!important;top:0;left:0;width:100%!important;display:flex!important;flex-direction:column!important}'
+'.ssym{width:76px!important;height:72px!important;margin:4px 0!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:34px!important;font-weight:900!important;border-radius:10px!important;flex-shrink:0!important;box-sizing:border-box!important}'
+'.ssym img{width:52px!important;height:52px!important;object-fit:contain!important;display:block!important;border-radius:6px!important}'
+'.ssym svg{display:block!important}'
+'.sc-btc{background:radial-gradient(circle at 45% 40%,#f7b733,#f7931a,#c86000)!important;color:#fff!important}'
+'.sc-eth{background:radial-gradient(circle at 45% 40%,#8ba8f0,#627eea,#2a4ec2)!important;color:#fff!important}'
+'.sc-sol{background:radial-gradient(circle at 45% 40%,#c27aff,#9945ff,#6015b0)!important;color:#fff!important}'
+'.sc-usd{background:radial-gradient(circle at 45% 40%,#3ecf9e,#26a17b,#0f6d52)!important;color:#fff!important}'
+'.sc-moto{background:radial-gradient(circle at 45% 40%,#34d399,#10b981,#047857)!important;color:#fff!important}'
+'.sc-star{background:radial-gradient(circle at 45% 40%,#ffe97a,#f5c518,#c09a00)!important;color:#5a3e00!important}'
+'.sc-cat{background:radial-gradient(circle at 45% 40%,#fde8b5,#e8c77a,#b89040)!important;color:#5a3e00!important}'
+'.sc-pill{background:radial-gradient(circle at 45% 40%,#1a0a00,#0d0500,#000)!important;color:#fff!important}'
+'.spl-zone{position:absolute;left:0;right:0;top:86px;height:80px;background:linear-gradient(180deg,transparent 0%,rgba(247,147,26,.05) 30%,rgba(247,147,26,.09) 50%,rgba(247,147,26,.05) 70%,transparent 100%);pointer-events:none;border-radius:4px;z-index:4}'
+'.spl1{position:absolute;left:-3px;right:-3px;top:126px;height:2px;background:linear-gradient(90deg,transparent 0%,rgba(247,147,26,.5) 6%,#f7931a 22%,#ffd060 50%,#f7931a 78%,rgba(247,147,26,.5) 94%,transparent 100%);box-shadow:0 0 5px rgba(247,147,26,.9),0 0 14px rgba(247,147,26,.6),0 0 30px rgba(247,147,26,.25);pointer-events:none;border-radius:1px;z-index:7;animation:plGlow 2.8s ease-in-out infinite}'
+'@keyframes plGlow{0%,100%{opacity:.75;box-shadow:0 0 5px rgba(247,147,26,.8),0 0 14px rgba(247,147,26,.5),0 0 28px rgba(247,147,26,.2)}50%{opacity:1;box-shadow:0 0 7px rgba(255,208,96,.95),0 0 20px rgba(247,147,26,.75),0 0 42px rgba(247,147,26,.35)}}'
+'.spl1.spayline{animation:payFlash 0.7s ease-in-out infinite!important;height:3px!important;background:linear-gradient(90deg,transparent,#ffd060 10%,#fff 50%,#ffd060 90%,transparent)!important;box-shadow:0 0 10px #ffd060,0 0 24px #f7931a,0 0 48px rgba(247,147,26,.55)!important}'
+'.sline{font-size:15px!important;font-weight:900!important;text-align:center!important;letter-spacing:.06em;text-shadow:0 0 12px rgba(247,147,26,.6);padding:6px 0!important}'
+'.scred{text-align:center;font-size:11px;color:rgba(247,147,26,.6);letter-spacing:.12em;font-weight:700}'
+'.sl-machine-row{display:flex;align-items:center;gap:0}'
+'.sl-handle-outer{display:flex;flex-direction:column;align-items:center;padding-left:10px;flex-shrink:0}'
+'.sl-handle-track{width:18px;height:220px;background:linear-gradient(90deg,#1a1a1a,#555,#1a1a1a);border-radius:9px;border:2px solid #333;position:relative;overflow:visible;box-shadow:inset 0 0 10px rgba(0,0,0,.7),2px 0 8px rgba(0,0,0,.4)}'
+'.sl-handle{cursor:pointer;position:absolute;left:50%;top:8px;transform:translateX(-50%);transition:top .4s cubic-bezier(.25,1.6,.5,1);user-select:none;-webkit-user-select:none;z-index:2}'
+'.sl-handle.pulled{top:150px}'
+'.sl-handle-ball{width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9070,#e53e1e,#7a1010);box-shadow:0 0 26px rgba(255,60,0,.8),0 4px 12px rgba(0,0,0,.7);border:2px solid rgba(255,140,80,.5);transition:box-shadow .2s}'
+'.sl-handle:hover .sl-handle-ball{box-shadow:0 0 44px rgba(255,90,0,1),0 6px 18px rgba(0,0,0,.8)!important}'
+'.sl-handle-base{width:36px;height:20px;background:linear-gradient(180deg,#777,#2a2a2a);border-radius:6px;border:2px solid #111;box-shadow:0 4px 12px rgba(0,0,0,.7);flex-shrink:0;margin-top:-2px}'
+'.srcol.sl-spin{filter:blur(2.5px) brightness(1.5)!important}'
+'.srcol.sl-land{filter:none!important;transition:filter .5s ease!important}'
+'.sl-glass{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.07) 0%,transparent 20%,transparent 80%,rgba(0,0,0,.22) 100%);pointer-events:none;border-radius:12px;z-index:6}'
+'@keyframes slParticle{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--dr)) scale(.05);opacity:0}}'
+'@keyframes slWinPulse{0%,100%{box-shadow:0 0 28px rgba(247,147,26,.4),inset 0 0 14px rgba(0,0,0,.7)}50%{box-shadow:0 0 70px rgba(247,147,26,1),0 0 130px rgba(247,147,26,.5),inset 0 0 14px rgba(0,0,0,.7)}}'
+'.sl-win .sreels{animation:slWinPulse .65s ease-in-out infinite!important}'
+'.rfelt-b .rtnum{font-size:clamp(14px,2vh,22px)!important;border-radius:6px!important}'
+'.rfelt-b .rout{font-size:clamp(12px,1.7vh,18px)!important;padding:clamp(8px,1.4vh,18px) 4px!important;border-radius:6px!important}'
+'.rfelt-b .r21btn{font-size:clamp(12px,1.6vh,17px)!important;border-radius:6px!important}'
+'.rfelt-b .rt0{font-size:clamp(16px,2.2vh,26px)!important;min-width:36px!important;border-radius:6px!important}'
+'@keyframes floatCoin{0%{transform:translateY(110vh) rotate(0deg);opacity:0}8%{opacity:0.13}88%{opacity:0.13}100%{transform:translateY(-120px) rotate(400deg);opacity:0}}'
+'.bg-coin{position:fixed;font-size:22px;animation:floatCoin linear infinite;pointer-events:none;z-index:0;user-select:none}'
+'#lwb-wrap{background:linear-gradient(135deg,#0e0f1a,#131420);border:1px solid rgba(247,147,26,.18);border-radius:14px;padding:12px 14px;margin-top:14px}'
+'#lwb-wrap .lwtit{font-size:10px;font-weight:900;color:#f7931a;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px}';
document.head.appendChild(s2);
// ── Floating background coins
(function(){
  var coins=['₿','₿','₿','⊙','⊙','M','₿','⊙'];
  coins.forEach(function(sym){
    var el=document.createElement('div');el.className='bg-coin';
    el.textContent=sym;
    var left=5+Math.random()*90;
    var dur=12+Math.random()*18;
    var delay=-(Math.random()*dur);
    el.style.cssText='left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;'
      +'color:'+(sym==='₿'?'rgba(247,147,26,1)':'rgba(16,185,129,1)')+';';
    document.body.appendChild(el);
  });
})();
// ── Recent wins panel (inject after game grid)
(function(){
  var wrap=document.getElementById('pg-casino');if(!wrap)return;
  var panel=document.createElement('div');panel.id='lwb-wrap';
  panel.innerHTML='<div class="lwtit">🏆 Recent Results</div><div id="lwb"><div style="color:#4b5563;font-size:11px;text-align:center;padding:10px">No games yet</div></div>';
  wrap.appendChild(panel);
})();
var d=document.createElement('div');d.id='fsov';
d.innerHTML='<div class="fs-topbar"></div>'
+'<div class="fsh"><span id="fsico" style="font-size:26px;filter:drop-shadow(0 0 8px rgba(247,147,26,.6))">🎮</span>'
+'<span style="font-size:18px;font-weight:900;margin-left:4px;background:linear-gradient(90deg,#f7931a,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent" id="fstit">Game</span>'
+'<div style="margin-left:auto;display:flex;align-items:center;gap:10px">'
+'<div class="bal" style="border-color:rgba(247,147,26,.5);box-shadow:0 0 14px rgba(247,147,26,.15)"><span>🪙</span><div><div id="fssat" style="font-weight:800;color:#f7931a;font-size:13px">--</div><div id="fsbtc" style="color:#6b7280;font-size:10px">--</div></div></div>'
+'<button class="fscls" onclick="closeFSOv()">✕ Close</button></div></div>'
+'<div class="fsb"><div class="fsM" id="fsM"></div><div class="fsC" id="fsC"></div></div>';
document.body.appendChild(d);
})();

function openFSOv(ico,tit,mH,cH,fn){
  document.getElementById('fsico').textContent=ico;
  document.getElementById('fstit').textContent=tit;
  document.getElementById('fsM').innerHTML=mH;
  document.getElementById('fsC').innerHTML=cH;
  updFSBal();
  document.getElementById('fsov').classList.add('on');
  if(fn)setTimeout(fn,60);
}
function closeFSOv(){
  document.getElementById('fsov').classList.remove('on');
  cancelAnimationFrame(crAnimId);crAnimId=null;crState='idle';
  cancelAnimationFrame(rAnimId);rAnimId=null;rSpinning=false;
  cancelAnimationFrame(pkAnimId);pkAnimId=null;pkActiveBalls=[];
  slAmbientStop();
}
function updFSBal(){
  var s=document.getElementById('fssat'),b=document.getElementById('fsbtc');
  if(s)s.textContent=BAL.toLocaleString()+' sat';
  if(b)b.textContent=(BAL/1e8).toFixed(5)+' BTC';
}

// ─── BALANCE ──────────────────────────────────────────────────────────────────
function saveBal(){localStorage.setItem('bal',BAL);}
function updBal(){
  document.getElementById('bsat').textContent=BAL.toLocaleString();
  document.getElementById('bbtc').textContent=(BAL/1e8).toFixed(5)+' BTC';
  var sc=document.getElementById('scred');if(sc)sc.textContent='Credits: '+BAL.toLocaleString()+' sat';
  updFSBal();saveBal();
}
function chk(a){
  if(a<1000){toast('Min bet: 1,000 sat','er');return false;}
  if(a>BAL){toast('Insufficient balance','er');return false;}
  return true;
}

// ─── PRICES ───────────────────────────────────────────────────────────────────
function fetchPrices(){
  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true')
  .then(function(r){return r.json();})
  .then(function(d){
    var b=d.bitcoin,e=d.ethereum;
    if(b){document.getElementById('bp').textContent='$'+Math.round(b.usd).toLocaleString();var bc=b.usd_24h_change;document.getElementById('bc').textContent=(bc>=0?'+':'')+bc.toFixed(2)+'%';document.getElementById('bc').className=bc>=0?'up':'dn';}
    if(e){document.getElementById('ep').textContent='$'+Math.round(e.usd).toLocaleString();var ec=e.usd_24h_change;document.getElementById('ec').textContent=(ec>=0?'+':'')+ec.toFixed(2)+'%';document.getElementById('ec').className=ec>=0?'up':'dn';}
  }).catch(function(){document.getElementById('bp').textContent='$85,420';document.getElementById('bc').textContent='+2.14%';document.getElementById('bc').className='up';document.getElementById('ep').textContent='$3,241';document.getElementById('ec').textContent='+1.87%';document.getElementById('ec').className='up';});
}
fetchPrices();setInterval(fetchPrices,60000);

// ─── LIVE FEED ────────────────────────────────────────────────────────────────
var FNAMES=['Satoshi***x','BitKing','CryptoAce','Whale***99','Anonymous','MoonBet','Player***77'];
var FGAMES=['Coin Flip','Blackjack','Dice','Crash','Roulette','Plinko','Slots','Mines'];
function genFeed(){
  var items=[];
  for(var i=0;i<7;i++){var n=FNAMES[~~(Math.random()*FNAMES.length)];var a=(Math.random()*.12+.001).toFixed(5);var g=FGAMES[~~(Math.random()*FGAMES.length)];items.push('<span style="color:#6b7280">'+n+' won <b style="color:#10b981">₿ '+a+'</b> on '+g+'</span>');}
  document.getElementById('fi').innerHTML=items.join('<span style="color:#1e1f30;margin:0 6px">|</span>');
}
genFeed();setInterval(genFeed,18000);

// ─── NAV ──────────────────────────────────────────────────────────────────────
function pg(name){
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  document.getElementById('pg-'+name).classList.add('on');
  document.querySelectorAll('.nt').forEach(function(t){t.classList.remove('on');});
  var nts=document.querySelectorAll('.nt');
  if(name==='casino')nts[0].classList.add('on');
  else if(name==='sports'){nts[1].classList.add('on');loadSport(curSport);}
}
function sg(id){
  pg('casino');
  if(id==='cf')openCF();
  else if(id==='bj')openBJ();
  else if(id==='dice')openDice();
  else if(id==='crash')openCrash();
  else if(id==='roul')openRoul();
  else if(id==='plinko')openPlinko();
  else if(id==='slots')openSlots();
  else if(id==='mines')openMines();
}
function cp(){closeFSOv();}
function sa(el){document.querySelectorAll('.si').forEach(function(i){i.classList.remove('on');});el.classList.add('on');}

// GAMES GRID
var GAMES=[
  {id:'cf',n:'Coin Flip',ico:'🪙',bg:'bg0',badge:'hot',rtp:'97.5'},
  {id:'bj',n:'Blackjack',ico:'♠',bg:'bg2',badge:'hot',rtp:'99.5'},
  {id:'dice',n:'Bitcoin Dice',ico:'🎲',bg:'bg1',badge:'',rtp:'98.0'},
  {id:'crash',n:'Crash',ico:'📈',bg:'bg5',badge:'new',rtp:'97.0'},
  {id:'roul',n:'Roulette',ico:'🎡',bg:'bg3',badge:'hot',rtp:'97.3'},
  {id:'plinko',n:'Plinko',ico:'🔵',bg:'bg6',badge:'new',rtp:'97.0'},
  {id:'slots',n:'Slots',ico:'🎰',bg:'bg4',badge:'',rtp:'96.5'},
  {id:'mines',n:'Mines',ico:'💣',bg:'bg7',badge:'new',rtp:'97.0'},
];
(function(){
  var h='';
  GAMES.forEach(function(g){
    var bd=g.badge==='hot'?'<div class="gbdg hot">HOT</div>':g.badge==='new'?'<div class="gbdg new">NEW</div>':'';
    h+='<div class="gc" onclick="sg(\''+g.id+'\')"><div class="gbg '+g.bg+'">'+g.ico+'</div>'+bd;
    h+='<div class="gbdg rtp">'+g.rtp+'%</div><div class="gov"><button class="pbtn">▶ Play</button></div>';
    h+='<div class="gi"><div class="gn">'+g.n+'</div><div class="gpr">OPNet</div></div></div>';
  });
  document.getElementById('gg').innerHTML=h;
})();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sa2(id,v){var el=document.getElementById(id);if(el)el.value=Math.max(1000,Math.min(v,BAL));}
function iv(id){return parseInt(document.getElementById(id).value)||0;}
function uw(game){
  var e;
  if(game==='cf'){var a1=iv('cfa');e=document.getElementById('cfw');if(e)e.value=Math.floor(a1*1.95).toLocaleString()+' sat';}
  else if(game==='bj'){var a2=iv('bja');e=document.getElementById('bjw');if(e)e.value=Math.floor(a2*1.5).toLocaleString()+' sat';}
  else if(game==='roul'){var a3=iv('roa');var m=rSel<=36?36:(rSel>=43?3:2);e=document.getElementById('row');if(e)e.value=Math.floor(a3*m).toLocaleString()+' sat';}
  else if(game==='slots'){var a4=iv('sla');e=document.getElementById('slw');if(e)e.value=Math.floor(a4*200).toLocaleString()+' sat';}
}
function showRes(id,won,profit,label){
  var el=document.getElementById(id);if(!el)return;
  el.style.display='block';el.className='res '+(won?'w':'l');
  el.innerHTML=won?'🏆 <strong>WIN!</strong> +'+profit.toLocaleString()+' sat — '+label:'💔 <strong>LOST</strong> — '+label;
  var game=GAME_NAMES[id]||id;
  recentWins.unshift({game:game,won:won,profit:profit});
  if(recentWins.length>10)recentWins.pop();
  updRecentWins();
}
function updRecentWins(){
  var el=document.getElementById('lwb');if(!el)return;
  if(!recentWins.length){el.innerHTML='<div style="color:#4b5563;font-size:11px;text-align:center;padding:10px">No games yet</div>';return;}
  el.innerHTML=recentWins.map(function(r){
    var col=r.won?'#10b981':'#ef4444';
    var ico=r.won?'🏆':'💔';
    var amt=r.won?'+'+r.profit.toLocaleString()+' sat':'loss';
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
      +'<span>'+ico+'</span>'
      +'<span style="flex:1;font-size:11px;color:#9ca3af">'+r.game+'</span>'
      +'<span style="font-size:11px;font-weight:800;color:'+col+'">'+amt+'</span>'
      +'</div>';
  }).join('');
}
function rSpinSound(dur){
  try{
    if(rAudioCtx){try{rAudioCtx.close();}catch(e){}}
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    rAudioCtx=ctx;
    var t=ctx.currentTime,elapsed=0;
    while(elapsed<dur/1000-0.08){
      var prog=elapsed/(dur/1000);
      var interval=0.055+prog*prog*0.42;
      var osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=550+Math.random()*150;
      gain.gain.setValueAtTime(0.22,t+elapsed);
      gain.gain.exponentialRampToValueAtTime(0.001,t+elapsed+0.045);
      osc.start(t+elapsed);osc.stop(t+elapsed+0.05);
      elapsed+=interval;
    }
    setTimeout(function(){try{ctx.close();}catch(e){}rAudioCtx=null;},dur+300);
  }catch(e){}
}
function showWin(amt,game){
  document.getElementById('wamt').textContent='+'+amt.toLocaleString()+' sat';
  document.getElementById('wgame').textContent=game;
  document.getElementById('wb').classList.add('on');confetti();
}
function cwb(){document.getElementById('wb').classList.remove('on');}
function confetti(){
  var c=['#f7931a','#fbbf24','#10b981','#ef4444','#06b6d4','#fff','#a855f7','#ec4899','#3b82f6','#84cc16'];
  for(var i=0;i<120;i++){
    var el=document.createElement('div');el.className='cp';
    var sz=4+Math.random()*9,rot=Math.random()*360;
    var shape=Math.random()<.33?'50%':Math.random()<.5?'2px':'0';
    el.style.cssText='left:'+Math.random()*100+'vw;top:-14px;background:'+c[~~(Math.random()*c.length)]+';width:'+sz+'px;height:'+(sz*(Math.random()<.5?1:2.2))+'px;animation-duration:'+(1.4+Math.random()*2.8)+'s;animation-delay:'+(Math.random()*.8)+'s;border-radius:'+shape+';transform:rotate('+rot+'deg)';
    document.body.appendChild(el);setTimeout(function(e){return function(){e.remove()};}(el),5500);
  }
}
function toast(msg,type){
  var el=document.createElement('div');el.className='toast'+(type==='ok'?' ok':type==='er'?' er':'');
  el.textContent=msg;document.getElementById('toasts').appendChild(el);
  setTimeout(function(){el.remove();},3800);
}

// ─── COIN FLIP ────────────────────────────────────────────────────────────────
function openCF(){
  cfSel=0;
  var mH='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:28px">'
    +'<div style="perspective:500px;width:180px;height:180px"><div class="coin" id="cfcoin" style="width:180px;height:180px"><div class="cf ch" style="font-size:72px">₿</div><div class="cf ct" style="font-size:72px">🌙</div></div></div>'
    +'<div class="cpicks" style="width:280px">'
    +'<div class="cp on" id="cph" onclick="cfp(0)" style="padding:14px 8px"><span style="font-size:36px">₿</span><br>HEADS</div>'
    +'<div class="cp" id="cpt" onclick="cfp(1)" style="padding:14px 8px"><span style="font-size:36px">🌙</span><br>TAILS</div>'
    +'</div>'
    +'<div class="res" id="cfr" style="width:280px;text-align:center"></div>'
    +'</div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="cfa" value="10000" min="1000" oninput="uw(\'cf\')" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'cfa\',1000);uw(\'cf\')">1k</div><div class="qb" onclick="sa2(\'cfa\',5000);uw(\'cf\')">5k</div><div class="qb" onclick="sa2(\'cfa\',10000);uw(\'cf\')">10k</div><div class="qb" onclick="sa2(\'cfa\',50000);uw(\'cf\')">50k</div><div class="qb" onclick="sa2(\'cfa\',Math.floor(BAL/2));uw(\'cf\')">½</div><div class="qb" onclick="sa2(\'cfa\',BAL);uw(\'cf\')">MAX</div></div>'
    +'<div class="cl">Win</div><input class="ci wv" readonly id="cfw" value="19,500 sat" style="width:100%">'
    +'<div class="ptbl"><div class="ph">PAYOUT</div><div class="pr"><span>✅ Correct pick</span><span>1.95×</span></div><div class="pr"><span>❌ Wrong pick</span><span>—</span></div></div>'
    +'<button class="bplay" id="cfbtn" onclick="playCF()" style="margin-top:auto">🪙 FLIP COIN</button>';
  openFSOv('🪙','Coin Flip',mH,cH,function(){uw('cf');});
}
function cfp(v){
  cfSel=v;
  document.getElementById('cph').classList.toggle('on',v===0);
  document.getElementById('cpt').classList.toggle('on',v===1);
}
function playCF(){
  var amt=iv('cfa');if(!chk(amt)||SPIN)return;
  SPIN=true;document.getElementById('cfbtn').disabled=true;
  document.getElementById('cfr').style.display='none';
  var coin=document.getElementById('cfcoin');
  coin.style.transition='transform 1.1s cubic-bezier(.4,0,.2,1)';
  coin.style.transform='rotateY(1800deg)';
  setTimeout(function(){
    SPIN=false;document.getElementById('cfbtn').disabled=false;
    var result=Math.random()<.5?0:1;
    coin.style.transition='none';coin.style.transform='rotateY('+(result===0?0:180)+'deg)';
    var won=result===cfSel;
    if(won){var p=Math.floor(amt*1.95);BAL+=p-amt;updBal();showRes('cfr',true,p-amt,result===0?'Heads ₿':'Tails 🌙');showWin(p,'Coin Flip');}
    else{BAL-=amt;updBal();showRes('cfr',false,0,(result===0?'Heads':'Tails')+' — wrong pick');toast('❌ -'+amt.toLocaleString()+' sat','er');}
  },1200);
}

// ─── BLACKJACK ────────────────────────────────────────────────────────────────
function openBJ(){
  var mH='<div class="bjtbl">'
    +'<div class="bjzone">'
    +'<div><div class="bjlb2">DEALER <span class="bjsc2" id="dsc">0</span></div><div class="bjrow" id="dhand"></div></div>'
    +'<div style="border-top:2px solid rgba(255,255,255,.08);margin:4px 0"></div>'
    +'<div><div class="bjlb2">YOU <span class="bjsc2" id="psc">0</span></div><div class="bjrow" id="phand"></div></div>'
    +'</div>'
    +'<div class="res" id="bjr" style="text-align:center"></div>'
    +'</div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="bja" value="10000" min="1000" oninput="uw(\'bj\')" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'bja\',1000);uw(\'bj\')">1k</div><div class="qb" onclick="sa2(\'bja\',5000);uw(\'bj\')">5k</div><div class="qb" onclick="sa2(\'bja\',10000);uw(\'bj\')">10k</div><div class="qb" onclick="sa2(\'bja\',50000);uw(\'bj\')">50k</div><div class="qb" onclick="sa2(\'bja\',Math.floor(BAL/2));uw(\'bj\')">½</div></div>'
    +'<div class="cl">Blackjack Win (1.5×)</div><input class="ci wv" readonly id="bjw" style="width:100%">'
    +'<div style="display:flex;gap:6px">'
    +'<button class="bjb" id="bjhit" onclick="bjHit()" disabled style="flex:1">🃏 Hit</button>'
    +'<button class="bjb" id="bjstand" onclick="bjStand()" disabled style="flex:1">✋ Stand</button>'
    +'<button class="bjb" id="bjdbl" onclick="bjDouble()" disabled style="flex:1">2× Dbl</button>'
    +'</div>'
    +'<button class="bplay" id="bjbtn" onclick="bjDeal()">♠ DEAL CARDS</button>'
    +'<div class="ptbl"><div class="ph">RULES</div>'
    +'<div class="pr"><span>Blackjack (A+10)</span><span style="color:#f7931a">2.5×</span></div>'
    +'<div class="pr"><span>Win</span><span style="color:#10b981">2×</span></div>'
    +'<div class="pr"><span>Push (tie)</span><span>refund</span></div>'
    +'<div class="pr"><span>Dealer hits to 17</span><span></span></div>'
    +'</div>';
  openFSOv('♠','Blackjack',mH,cH,function(){resetBJ();uw('bj');});
}
var SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function makeDeck(){
  var d=[];SUITS.forEach(function(s){RANKS.forEach(function(r){d.push({s:s,r:r});});});
  for(var i=d.length-1;i>0;i--){var j=~~(Math.random()*(i+1));var t=d[i];d[i]=d[j];d[j]=t;}
  return d;
}
function cardVal(r){if(['J','Q','K'].indexOf(r)>=0)return 10;if(r==='A')return 11;return parseInt(r);}
function handVal(h){var v=0,a=0;h.forEach(function(c){v+=cardVal(c.r);if(c.r==='A')a++;});while(v>21&&a>0){v-=10;a--;}return v;}
function mkCard(c,fd,delay){
  if(fd)return '<div class="card2 fd" style="animation-delay:'+(delay||0)+'s"></div>';
  var red=c.s==='♥'||c.s==='♦';
  return '<div class="card2 '+(red?'r':'b')+'" style="animation-delay:'+(delay||0)+'s"><div class="c2r">'+c.r+'<br>'+c.s+'</div><div class="c2s">'+c.s+'</div><div class="c2b">'+c.r+'<br>'+c.s+'</div></div>';
}
function renderBJ(){
  var ph=document.getElementById('phand'),dh=document.getElementById('dhand');if(!ph)return;
  ph.innerHTML=bjPlayer.map(function(c,i){return mkCard(c,false,i*.1);}).join('');
  var sa=bjState==='dealer'||bjState==='done';
  dh.innerHTML=bjDealer.map(function(c,i){return mkCard(c,i===1&&!sa,i*.1);}).join('');
  document.getElementById('psc').textContent=handVal(bjPlayer);
  document.getElementById('dsc').textContent=sa?handVal(bjDealer):'?';
}
function resetBJ(){
  bjState='idle';bjPlayer=[];bjDealer=[];
  var ph=document.getElementById('phand'),dh=document.getElementById('dhand');if(ph)ph.innerHTML='';if(dh)dh.innerHTML='';
  var ps=document.getElementById('psc'),ds=document.getElementById('dsc');if(ps)ps.textContent='0';if(ds)ds.textContent='0';
  ['bjhit','bjstand','bjdbl'].forEach(function(b){var e=document.getElementById(b);if(e)e.disabled=true;});
  var btn=document.getElementById('bjbtn');if(btn){btn.disabled=false;btn.textContent='♠ DEAL CARDS';}
  var res=document.getElementById('bjr');if(res)res.style.display='none';
}
function bjDeal(){
  var amt=iv('bja');if(!chk(amt))return;
  bjBet=amt;BAL-=amt;updBal();
  bjDeck=makeDeck();bjPlayer=[];bjDealer=[];
  bjPlayer.push(bjDeck.pop(),bjDeck.pop());bjDealer.push(bjDeck.pop(),bjDeck.pop());
  bjState='player';renderBJ();
  ['bjhit','bjstand'].forEach(function(b){var e=document.getElementById(b);if(e)e.disabled=false;});
  var dbl=document.getElementById('bjdbl');if(dbl)dbl.disabled=false;
  var btn=document.getElementById('bjbtn');if(btn)btn.disabled=true;
  var res=document.getElementById('bjr');if(res)res.style.display='none';
  if(handVal(bjPlayer)===21)bjStand();
}
function bjHit(){bjPlayer.push(bjDeck.pop());renderBJ();var dbl=document.getElementById('bjdbl');if(dbl)dbl.disabled=true;if(handVal(bjPlayer)>21)bjEnd('bust');}
function bjDouble(){
  if(BAL<bjBet){toast('Not enough for double','er');return;}
  BAL-=bjBet;bjBet*=2;updBal();bjPlayer.push(bjDeck.pop());renderBJ();
  if(handVal(bjPlayer)>21)bjEnd('bust');else bjStand();
}
function bjStand(){
  bjState='dealer';['bjhit','bjstand','bjdbl'].forEach(function(b){var e=document.getElementById(b);if(e)e.disabled=true;});
  var tid=setInterval(function(){if(handVal(bjDealer)<17){bjDealer.push(bjDeck.pop());renderBJ();}else{clearInterval(tid);bjEnd('stand');}},550);
}
function bjEnd(reason){
  bjState='done';renderBJ();
  var pv=handVal(bjPlayer),dv=handVal(bjDealer);
  var msg='',won=false,push=false;
  if(reason==='bust')msg='Bust! Hand: '+pv;
  else if(dv>21){msg='Dealer busts! You win!';won=true;}
  else if(pv>dv){msg='You win! '+pv+' vs '+dv;won=true;}
  else if(pv===dv){msg='Push — '+pv;push=true;}
  else msg='Dealer wins: '+dv+' vs '+pv;
  if(won){
    var nat=bjPlayer.length===2&&pv===21;
    var pay=nat?Math.floor(bjBet*2.5):bjBet*2;
    BAL+=pay;updBal();showRes('bjr',true,pay-bjBet,msg+(nat?' 🃏 Blackjack!':''));showWin(pay,'Blackjack');
  } else if(push){BAL+=bjBet;updBal();showRes('bjr',true,0,msg);}
  else{showRes('bjr',false,0,msg);toast('❌ -'+bjBet.toLocaleString()+' sat','er');}
  var btn=document.getElementById('bjbtn');if(btn){btn.disabled=false;btn.textContent='♠ NEW HAND';}
}

// ─── DICE (STAKE-STYLE) ───────────────────────────────────────────────────────
function openDice(){
  dThresh=50;dOver=true;
  var mH='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;width:min(100%,560px)">'
    +'<div class="dnum" id="dnum" style="color:#4b5563">—</div>'
    +'<div style="width:100%;padding:0 24px">'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:6px"><span>0</span><span style="font-weight:700" id="dthshow">50.00</span><span>100</span></div>'
    +'<input class="dsl" type="range" id="dslider" min="2" max="98" value="50" oninput="dSlide(this.value)">'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-top:8px">'
    +'<span id="dlose" style="color:#ef4444">LOSE 50.51%</span>'
    +'<span id="dwinch" style="color:#10b981">WIN 49.49%</span>'
    +'</div>'
    +'</div>'
    +'<div class="dtog" style="width:min(100%,360px)">'
    +'<div class="dtt on" id="dov" onclick="dSetOver(true)">▲ Roll Over</div>'
    +'<div class="dtt" id="dun" onclick="dSetOver(false)">▼ Roll Under</div>'
    +'</div>'
    +'<div class="res" id="dcr" style="width:min(100%,400px);text-align:center"></div>'
    +'</div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="dca" value="10000" min="1000" oninput="dUpdate()" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'dca\',1000);dUpdate()">1k</div><div class="qb" onclick="sa2(\'dca\',5000);dUpdate()">5k</div><div class="qb" onclick="sa2(\'dca\',10000);dUpdate()">10k</div><div class="qb" onclick="sa2(\'dca\',50000);dUpdate()">50k</div><div class="qb" onclick="sa2(\'dca\',Math.floor(BAL/2));dUpdate()">½</div><div class="qb" onclick="sa2(\'dca\',BAL);dUpdate()">MAX</div></div>'
    +'<div class="ptbl"><div class="ph">LIVE STATS</div>'
    +'<div class="pr"><span>Threshold</span><span id="dth2">50.00 (Over)</span></div>'
    +'<div class="pr"><span>Win Chance</span><span id="dwch" style="color:#10b981">49.49%</span></div>'
    +'<div class="pr"><span>Multiplier</span><span id="dmul" style="color:#f7931a">1.94×</span></div>'
    +'<div class="pr"><span>Profit on Win</span><span id="dpow" style="color:#10b981">9,400 sat</span></div>'
    +'</div>'
    +'<button class="bplay" id="dcbtn" onclick="playDice()" style="margin-top:auto">🎲 ROLL DICE</button>';
  openFSOv('🎲','Bitcoin Dice',mH,cH,function(){dUpdate();});
}
function dSlide(v){dThresh=parseInt(v);dUpdate();}
function dSetOver(v){
  dOver=v;
  document.getElementById('dov').classList.toggle('on',v);
  document.getElementById('dun').classList.toggle('on',!v);
  dUpdate();
}
function dUpdate(){
  var th=dThresh;
  var winCount=dOver?(99-th):(th-1);
  if(winCount<1)winCount=1;
  var winPct=winCount/99*100,losePct=100-winPct;
  var mult=parseFloat(((99/winCount)*0.97).toFixed(4));
  var bet=iv('dca')||10000;
  var profit=Math.floor(bet*mult)-bet;
  var el=function(id){return document.getElementById(id);};
  if(el('dthshow'))el('dthshow').textContent=th.toFixed(2);
  if(el('dth2'))el('dth2').textContent=th.toFixed(2)+(dOver?' (Over)':' (Under)');
  if(el('dwch'))el('dwch').textContent=winPct.toFixed(2)+'%';
  if(el('dmul'))el('dmul').textContent=mult.toFixed(2)+'×';
  if(el('dpow'))el('dpow').textContent=profit.toLocaleString()+' sat';
  if(el('dlose'))el('dlose').textContent='LOSE '+losePct.toFixed(2)+'%';
  if(el('dwinch'))el('dwinch').textContent='WIN '+winPct.toFixed(2)+'%';
}
function playDice(){
  var amt=iv('dca');if(!chk(amt)||SPIN)return;
  SPIN=true;var btn=document.getElementById('dcbtn');if(btn)btn.disabled=true;
  var winCount=dOver?(99-dThresh):(dThresh-1);if(winCount<1)winCount=1;
  var mult=parseFloat(((99/winCount)*0.97).toFixed(4));
  var result=Math.random()*100;
  var won=dOver?(result>dThresh):(result<dThresh);
  var numEl=document.getElementById('dnum');
  if(numEl){numEl.style.color='#4b5563';numEl.textContent='—';}
  var start=Date.now(),dur=900;
  (function animNum(){
    var prog=Math.min((Date.now()-start)/dur,1);
    var ease=1-Math.pow(1-prog,3);
    var cur=ease*result;
    if(numEl)numEl.textContent=cur.toFixed(2);
    if(prog<1){requestAnimationFrame(animNum);}
    else{
      SPIN=false;if(btn)btn.disabled=false;
      if(numEl)numEl.style.color=won?'#10b981':'#ef4444';
      if(won){var p=Math.floor(amt*mult);BAL+=p-amt;updBal();showRes('dcr',true,p-amt,'Rolled '+result.toFixed(2)+(dOver?' > ':' < ')+dThresh+' at '+mult.toFixed(2)+'×');showWin(p,'Dice');}
      else{BAL-=amt;updBal();showRes('dcr',false,0,'Rolled '+result.toFixed(2)+' — no win');toast('❌ -'+amt.toLocaleString()+' sat','er');}
    }
  })();
}

// ─── CRASH ────────────────────────────────────────────────────────────────────
function openCrash(){
  var mH='<div id="crfull">'
    +'<div class="crh2" id="chist"></div>'
    +'<canvas id="crash-cv"></canvas>'
    +'<div id="crmult2" style="color:#10b981">1.00×</div>'
    +'</div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="cra" value="10000" min="1000" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'cra\',1000)">1k</div><div class="qb" onclick="sa2(\'cra\',5000)">5k</div><div class="qb" onclick="sa2(\'cra\',10000)">10k</div><div class="qb" onclick="sa2(\'cra\',50000)">50k</div><div class="qb" onclick="sa2(\'cra\',Math.floor(BAL/2))">½</div></div>'
    +'<div class="cl" style="margin-top:4px">Auto Cashout at ×</div>'
    +'<input class="ci" type="number" id="crau" value="2.0" min="1.01" step="0.1" style="width:100%">'
    +'<div class="ptbl"><div class="ph">HOW TO PLAY</div>'
    +'<div style="font-size:11px;color:#6b7280;line-height:1.7">1. Place your bet<br>2. Multiplier rises from 1×<br>3. Cash out before it crashes!<br>4. Auto cashout exits at your target ×</div>'
    +'</div>'
    +'<button class="bplay" id="crbtn" onclick="crashAction()" style="margin-top:auto">📈 PLACE BET</button>'
    +'<div class="res" id="crr" style="text-align:center"></div>';
  openFSOv('📈','Crash',mH,cH,function(){
    crCanvas=document.getElementById('crash-cv');
    if(crCanvas){
      var cont=document.getElementById('crfull');
      crCanvas.width=cont.offsetWidth||500;
      crCanvas.height=Math.max(180,cont.offsetHeight-120);
      crCtx=crCanvas.getContext('2d');
      crStars=null; // rebuild star field for new canvas size
    }
    crState='idle';crMult=1;
    if(crHistory.length>0){
      var ch=document.getElementById('chist');
      if(ch)ch.innerHTML=crHistory.map(function(c){return '<span class="chi '+(c.s?'safe':'bust')+'">'+c.t+'</span>';}).join('');
    }
    drawCrashIdle();
  });
}
function crashPoint(){var r=Math.random();if(r<0.01)return 1.00;return Math.max(1.00,parseFloat((0.99/(1-r)).toFixed(2)));}
var crStars=null;
function buildStars(W,H){crStars=[];for(var i=0;i<110;i++){crStars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.3,a:Math.random()*.7+.15});}}
function drawStars(ctx,W,H){if(!crStars||crStars.length===0)buildStars(W,H);ctx.save();for(var i=0;i<crStars.length;i++){var s=crStars[i];ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,'+s.a+')';ctx.fill();}ctx.restore();}
function drawCrashIdle(){
  if(!crCtx||!crCanvas)return;
  var W=crCanvas.width,H=crCanvas.height;
  crCtx.clearRect(0,0,W,H);
  var bg=crCtx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#06030f');bg.addColorStop(1,'#0a0a18');
  crCtx.fillStyle=bg;crCtx.fillRect(0,0,W,H);
  drawStars(crCtx,W,H);
  crCtx.strokeStyle='rgba(255,255,255,0.04)';crCtx.lineWidth=1;
  for(var x=0;x<W;x+=W/8){crCtx.beginPath();crCtx.moveTo(x,0);crCtx.lineTo(x,H);crCtx.stroke();}
  for(var y=0;y<H;y+=H/5){crCtx.beginPath();crCtx.moveTo(0,y);crCtx.lineTo(W,y);crCtx.stroke();}
  crCtx.fillStyle='rgba(255,255,255,0.12)';crCtx.font='bold 18px sans-serif';crCtx.textAlign='center';crCtx.textBaseline='middle';
  crCtx.fillText('🚀 Place a bet to launch!',W/2,H/2);
}
function drawCrashFrame(crashed){
  if(!crCtx||!crCanvas)return;
  var W=crCanvas.width,H=crCanvas.height;
  crCtx.clearRect(0,0,W,H);
  var bg=crCtx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#06030f');bg.addColorStop(1,'#0a0a18');
  crCtx.fillStyle=bg;crCtx.fillRect(0,0,W,H);
  drawStars(crCtx,W,H);
  crCtx.strokeStyle='rgba(255,255,255,0.04)';crCtx.lineWidth=1;
  for(var x=0;x<W;x+=W/8){crCtx.beginPath();crCtx.moveTo(x,0);crCtx.lineTo(x,H);crCtx.stroke();}
  for(var y=0;y<H;y+=H/5){crCtx.beginPath();crCtx.moveTo(0,y);crCtx.lineTo(W,y);crCtx.stroke();}
  var maxMult=Math.max(crMult,1.5);
  var col=crashed?'#ef4444':'#10b981';
  var pad={l:W*0.06,r:W*0.88,t:H*0.88};
  crCtx.save();crCtx.beginPath();
  var pts=80,lastX=pad.l,lastY=pad.t;
  crCtx.moveTo(lastX,lastY);
  for(var i=1;i<=pts;i++){
    var t=(Date.now()-crStart)/1000*(i/pts);
    var m=Math.min(Math.pow(Math.E,t*0.07),crMult);
    var px=pad.l+pad.r*(i/pts);
    var py=pad.t-H*0.78*(Math.log(Math.max(m,1))/Math.log(maxMult));
    crCtx.lineTo(px,py);if(i===pts){lastX=px;lastY=py;}
  }
  crCtx.strokeStyle=col;crCtx.lineWidth=3;crCtx.shadowColor=col;crCtx.shadowBlur=14;crCtx.stroke();crCtx.shadowBlur=0;
  crCtx.lineTo(pad.l+pad.r,pad.t);crCtx.lineTo(pad.l,pad.t);crCtx.closePath();
  var grad=crCtx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,crashed?'rgba(239,68,68,.18)':'rgba(16,185,129,.14)');grad.addColorStop(1,'rgba(0,0,0,0)');
  crCtx.fillStyle=grad;crCtx.fill();crCtx.restore();
  crCtx.font='28px sans-serif';crCtx.textAlign='center';
  crCtx.fillText(crashed?'💥':'🚀',lastX,lastY-14);
  crCtx.fillStyle='rgba(255,255,255,0.22)';crCtx.font='bold 11px sans-serif';crCtx.textAlign='left';
  [1,1.5,2,5,10].forEach(function(ml){if(ml<=maxMult){var ly=pad.t-H*0.78*(Math.log(ml)/Math.log(maxMult));crCtx.fillText(ml+'×',4,ly+4);}});
}
function crashAction(){
  if(crState==='running'){cashOut();return;}
  var amt=iv('cra');if(!chk(amt))return;
  crBet=amt;BAL-=amt;updBal();
  crTarget=crashPoint();crMult=1.00;crState='running';crStart=Date.now();
  var btn=document.getElementById('crbtn');if(btn){btn.textContent='💰 CASH OUT';btn.style.background='linear-gradient(135deg,#10b981,#059669)';}
  var res=document.getElementById('crr');if(res)res.style.display='none';
  var multEl=document.getElementById('crmult2');if(multEl){multEl.textContent='1.00×';multEl.style.color='#10b981';}
  var autoCash=parseFloat((document.getElementById('crau')||{}).value)||0;
  cancelAnimationFrame(crAnimId);
  (function frame(){
    if(crState!=='running')return;
    crMult=parseFloat(Math.pow(Math.E,(Date.now()-crStart)/1000*0.07).toFixed(2));
    if(crMult>=crTarget){
      crMult=crTarget;crState='crashed';
      if(multEl){multEl.textContent=crTarget.toFixed(2)+'×';multEl.style.color='#ef4444';}
      if(btn){btn.textContent='📈 PLACE BET';btn.style.background='';}
      addCrashHist(crTarget.toFixed(2)+'×',false);drawCrashFrame(true);
      showRes('crr',false,0,'Crashed at '+crTarget.toFixed(2)+'×');toast('💥 Crashed at '+crTarget.toFixed(2)+'×','er');
      return;
    }
    if(autoCash>1&&crMult>=autoCash){cashOut();return;}
    if(multEl)multEl.textContent=crMult.toFixed(2)+'×';
    drawCrashFrame(false);crAnimId=requestAnimationFrame(frame);
  })();
}
function cashOut(){
  if(crState!=='running')return;
  cancelAnimationFrame(crAnimId);var m=crMult;crState='cashedout';
  var pay=Math.floor(crBet*m);BAL+=pay;updBal();
  var btn=document.getElementById('crbtn');if(btn){btn.textContent='📈 PLACE BET';btn.style.background='';}
  var multEl=document.getElementById('crmult2');if(multEl)multEl.style.color='#f7931a';
  addCrashHist(m.toFixed(2)+'× ✓',true);showRes('crr',true,pay-crBet,'Cashed out at '+m.toFixed(2)+'×');showWin(pay,'Crash');
}
function addCrashHist(txt,safe){
  crHistory.unshift({t:txt,s:safe});if(crHistory.length>10)crHistory.pop();
  var ch=document.getElementById('chist');if(!ch)return;
  ch.innerHTML=crHistory.map(function(c){return '<span class="chi '+(c.s?'safe':'bust')+'">'+c.t+'</span>';}).join('');
}

// ─── ROULETTE ─────────────────────────────────────────────────────────────────
var rLayout='B';
function roulFelt(isB){
  var g=isB?'4':'3',p=isB?'9px':'7px';
  return '<div class="rfelt'+(isB?' rfelt-b':'')+'" style="'+(isB?'flex:1;min-width:0;min-height:0;':'flex-shrink:0;')+'display:flex;flex-direction:column;gap:'+g+'px">'
    +'<div style="font-size:7px;font-weight:900;color:rgba(255,255,255,.25);text-align:center;letter-spacing:.18em">★ EUROPEAN ROULETTE — PLACE YOUR BETS ★</div>'
    +'<div style="display:flex;gap:'+g+'px;'+(isB?'flex:1;min-height:0':'')+'>">'
    +'<div class="rt0" onclick="rp(0,this)" style="writing-mode:vertical-lr;transform:rotate(180deg);font-size:15px;min-width:28px;padding:3px 0">0</div>'
    +'<div style="flex:1;display:flex;flex-direction:column;gap:'+g+'px;min-height:0">'
    +'<div id="row3" style="display:flex;gap:'+g+'px;flex:1"></div>'
    +'<div id="row2" style="display:flex;gap:'+g+'px;flex:1"></div>'
    +'<div id="row1" style="display:flex;gap:'+g+'px;flex:1"></div>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:'+g+'px;min-width:36px">'
    +'<div class="r21btn" onclick="rp(46,this)" style="flex:1">2:1</div>'
    +'<div class="r21btn" onclick="rp(47,this)" style="flex:1">2:1</div>'
    +'<div class="r21btn" onclick="rp(48,this)" style="flex:1">2:1</div>'
    +'</div></div>'
    +'<div style="display:flex;gap:'+g+'px'+(isB?'':';flex-shrink:0')+'">'
    +'<div style="min-width:28px"></div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(43,this)">1st 12</div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(44,this)">2nd 12</div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(45,this)">3rd 12</div>'
    +'<div style="min-width:36px"></div>'
    +'</div>'
    +'<div style="display:flex;gap:'+g+'px'+(isB?'':';flex-shrink:0')+'">'
    +'<div style="min-width:28px"></div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(41,this)">1–18</div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(40,this)">Even</div>'
    +'<div class="rout red-b on" id="rb37" style="flex:1;padding:'+p+' 4px" onclick="rp(37,this)">🔴 Red</div>'
    +'<div class="rout blk-b" id="rb38" style="flex:1;padding:'+p+' 4px" onclick="rp(38,this)">⚫ Black</div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(39,this)">Odd</div>'
    +'<div class="rout" style="flex:1;padding:'+p+' 4px" onclick="rp(42,this)">19–36</div>'
    +'<div style="min-width:36px"></div>'
    +'</div>'
    +'</div>';
}
function roulMainHtml(){
  var isB=rLayout==='B';
  var outerStyle=isB
    ?'display:flex;flex-direction:row;height:100%;padding:8px 14px;gap:8px;overflow:hidden'
    :'display:flex;flex-direction:column;height:100%;padding:8px 14px;gap:6px;overflow:hidden';
  var wrapStyle=isB
    ?'flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative;height:100%;aspect-ratio:1/1'
    :'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative';
  return '<div style="'+outerStyle+'">'
    +'<div id="roul-wrap" style="'+wrapStyle+'">'
    +'<canvas id="roul-cv" style="border-radius:50%;border:2px solid rgba(247,147,26,.32);box-shadow:0 0 50px rgba(247,147,26,.22)"></canvas>'
    +'<div id="roulres" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);color:#9ca3af;font-size:16px;font-weight:700;white-space:nowrap;background:rgba(10,11,15,.9);padding:5px 18px;border-radius:8px;pointer-events:none;border:1px solid rgba(247,147,26,.2)">Spin the wheel to begin</div>'
    +'</div>'
    +roulFelt(isB)
    +'</div>';
}
function roulPopulate(){
  function cls(n){return n===0?'ng':RREDS.indexOf(n)>=0?'nr':'nb';}
  var r3='',r2='',r1='';
  for(var col=1;col<=12;col++){
    var n3=col*3,n2=col*3-1,n1=col*3-2;
    r3+='<div class="rtnum '+cls(n3)+'" onclick="rp('+n3+',this)">'+n3+'</div>';
    r2+='<div class="rtnum '+cls(n2)+'" onclick="rp('+n2+',this)">'+n2+'</div>';
    r1+='<div class="rtnum '+cls(n1)+'" onclick="rp('+n1+',this)">'+n1+'</div>';
  }
  document.getElementById('row3').innerHTML=r3;
  document.getElementById('row2').innerHTML=r2;
  document.getElementById('row1').innerHTML=r1;
  var rb37=document.getElementById('rb37');if(rb37)rb37.classList.add('on');
  if(rSel>=0){var sel=document.querySelector('[onclick*="rp('+rSel+',"]');if(sel)sel.classList.add('on');}
  rWheelAngle=0;initRoul();uw('roul');
}
function switchRoulLayout(l){
  if(rLayout===l)return;
  rLayout=l;
  document.getElementById('fsM').innerHTML=roulMainHtml();
  document.getElementById('rla').classList.toggle('on',l==='A');
  document.getElementById('rlb').classList.toggle('on',l==='B');
  setTimeout(roulPopulate,60);
}
function openRoul(){
  rSel=37;
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="roa" value="10000" min="1000" oninput="uw(\'roul\')" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'roa\',1000);uw(\'roul\')">1k</div><div class="qb" onclick="sa2(\'roa\',5000);uw(\'roul\')">5k</div><div class="qb" onclick="sa2(\'roa\',10000);uw(\'roul\')">10k</div><div class="qb" onclick="sa2(\'roa\',50000);uw(\'roul\')">50k</div><div class="qb" onclick="sa2(\'roa\',Math.floor(BAL/2));uw(\'roul\')">½</div></div>'
    +'<div class="cl">Win (total return)</div><input class="ci wv" readonly id="row" style="width:100%">'
    +'<div class="ptbl"><div class="ph">PAYOUTS</div>'
    +'<div class="pr"><span>Straight number</span><span style="color:#f7931a">36×</span></div>'
    +'<div class="pr"><span>Column / Dozen</span><span>3×</span></div>'
    +'<div class="pr"><span>Red/Black/Odd/Even</span><span>2×</span></div>'
    +'<div class="pr"><span>1–18 / 19–36</span><span>2×</span></div>'
    +'</div>'
    +'<button class="bplay" id="robtn" onclick="playRoul()" style="margin-top:auto">🎡 SPIN WHEEL</button>'
    +'<div class="res" id="ror" style="text-align:center"></div>';
  openFSOv('🎡','European Roulette',roulMainHtml(),cH,function(){roulPopulate();});
}
function roulColor(n){if(n===0)return'#15803d';return RREDS.indexOf(n)>=0?'#b91c1c':'#111827';}
function initRoul(){
  rCanvas=document.getElementById('roul-cv');if(!rCanvas)return;
  var wrap=document.getElementById('roul-wrap');
  var size=Math.max(200,Math.min(wrap.offsetWidth,wrap.offsetHeight)-20);
  rCanvas.width=size;rCanvas.height=size;
  rCanvas.style.width=size+'px';rCanvas.style.height=size+'px';
  rCtx=rCanvas.getContext('2d');
  rWinIdx=-1;
  rDrawFrame(rWheelAngle,0,0,0);
  cancelAnimationFrame(rAnimId);
  (function idle(){if(rSpinning)return;rWheelAngle+=0.003;rDrawFrame(rWheelAngle,0,0,0);rAnimId=requestAnimationFrame(idle);})();
}
function rDrawFrame(wAngle,bAngle,bR,winFlash){
  if(!rCtx)return;
  var W=rCanvas.width,H=rCanvas.height,cx=W/2,cy=H/2,OR=Math.min(cx,cy)-4;
  rCtx.clearRect(0,0,W,H);
  // dark background
  var bgGrad=rCtx.createRadialGradient(cx,cy,0,cx,cy,OR+10);
  bgGrad.addColorStop(0,'#1a1a2e');bgGrad.addColorStop(1,'#08080f');
  rCtx.beginPath();rCtx.arc(cx,cy,OR+10,0,2*Math.PI);rCtx.fillStyle=bgGrad;rCtx.fill();
  // outer gold rim
  rCtx.beginPath();rCtx.arc(cx,cy,OR+5,0,2*Math.PI);
  var rimG=rCtx.createLinearGradient(cx-OR,cy-OR,cx+OR,cy+OR);
  rimG.addColorStop(0,'#8b6914');rimG.addColorStop(0.25,'#f7d060');rimG.addColorStop(0.5,'#c8960c');rimG.addColorStop(0.75,'#f7d060');rimG.addColorStop(1,'#8b6914');
  rCtx.lineWidth=10;rCtx.strokeStyle=rimG;rCtx.stroke();
  // inner shadow ring
  rCtx.beginPath();rCtx.arc(cx,cy,OR,0,2*Math.PI);rCtx.lineWidth=3;rCtx.strokeStyle='rgba(0,0,0,0.7)';rCtx.stroke();
  var SEG=2*Math.PI/37;
  // segments
  RWHEEL.forEach(function(num,i){
    var a0=wAngle+i*SEG-Math.PI/2,a1=a0+SEG;
    var isWin=(i===rWinIdx)&&winFlash>0;
    rCtx.beginPath();rCtx.moveTo(cx,cy);rCtx.arc(cx,cy,OR,a0,a1);rCtx.closePath();
    if(isWin){rCtx.fillStyle=(winFlash%12<6)?'#ffe44d':roulColor(num);}
    else{rCtx.fillStyle=roulColor(num);}
    rCtx.fill();
  });
  // inner wheel bowl — drawn before numbers so numbers appear on top of the ring
  rCtx.beginPath();rCtx.arc(cx,cy,OR*0.72,0,2*Math.PI);
  var bowl=rCtx.createRadialGradient(cx,cy,OR*0.2,cx,cy,OR*0.72);bowl.addColorStop(0,'#1c1c30');bowl.addColorStop(1,'#0d0e1a');
  rCtx.fillStyle=bowl;rCtx.fill();
  rCtx.strokeStyle='rgba(247,208,60,0.6)';rCtx.lineWidth=2.5;rCtx.stroke();
  // decorative spokes inside bowl
  for(var i=0;i<8;i++){var a=wAngle+i*Math.PI/4;rCtx.beginPath();rCtx.moveTo(cx+OR*0.18*Math.cos(a),cy+OR*0.18*Math.sin(a));rCtx.lineTo(cx+OR*0.72*Math.cos(a),cy+OR*0.72*Math.sin(a));rCtx.strokeStyle='rgba(180,140,0,0.18)';rCtx.lineWidth=1;rCtx.stroke();}
  // hub
  rCtx.beginPath();rCtx.arc(cx,cy,OR*0.22,0,2*Math.PI);
  var hub=rCtx.createRadialGradient(cx-OR*0.06,cy-OR*0.06,0,cx,cy,OR*0.22);hub.addColorStop(0,'#4a3000');hub.addColorStop(0.5,'#1e1400');hub.addColorStop(1,'#0d0e1a');
  rCtx.fillStyle=hub;rCtx.fill();rCtx.strokeStyle='#f7d03c';rCtx.lineWidth=2.5;rCtx.stroke();
  rCtx.fillStyle='#f7931a';rCtx.font='bold '+Math.round(OR*0.16)+'px sans-serif';rCtx.textAlign='center';rCtx.textBaseline='middle';rCtx.fillText('₿',cx,cy);
  // fret dividers in pocket ring (OR*0.72 to OR)
  for(var i=0;i<37;i++){
    var fa=wAngle+i*SEG-Math.PI/2;
    rCtx.beginPath();rCtx.moveTo(cx+OR*0.72*Math.cos(fa),cy+OR*0.72*Math.sin(fa));rCtx.lineTo(cx+OR*0.99*Math.cos(fa),cy+OR*0.99*Math.sin(fa));
    rCtx.strokeStyle='rgba(255,215,0,0.6)';rCtx.lineWidth=1.5;rCtx.stroke();
  }
  // numbers in the pocket ring — drawn last so nothing covers them
  var fs=Math.max(9,Math.round(OR*0.1));
  RWHEEL.forEach(function(num,i){
    var a0=wAngle+i*SEG-Math.PI/2,ma=a0+SEG/2;
    var tx=cx+OR*0.86*Math.cos(ma),ty=cy+OR*0.86*Math.sin(ma);
    rCtx.save();rCtx.translate(tx,ty);rCtx.rotate(ma+Math.PI/2);
    rCtx.shadowColor='rgba(0,0,0,1)';rCtx.shadowBlur=5;
    rCtx.fillStyle='#ffffff';rCtx.font='bold '+fs+'px sans-serif';rCtx.textAlign='center';rCtx.textBaseline='middle';
    rCtx.fillText(String(num),0,0);rCtx.shadowBlur=0;rCtx.restore();
  });
  // ball
  if(bR>0){
    var bx=cx+bR*Math.cos(bAngle),by=cy+bR*Math.sin(bAngle);
    var br=Math.max(4.5,OR*0.052);
    rCtx.beginPath();rCtx.arc(bx,by,br,0,2*Math.PI);
    var bgl=rCtx.createRadialGradient(bx-br*0.35,by-br*0.4,0,bx,by,br);
    bgl.addColorStop(0,'#ffffff');bgl.addColorStop(0.45,'#e0e0e0');bgl.addColorStop(1,'#888888');
    rCtx.fillStyle=bgl;rCtx.shadowColor='rgba(255,255,255,0.9)';rCtx.shadowBlur=12;rCtx.fill();rCtx.shadowBlur=0;
  }
}
function rp(v,el){
  rSel=v;document.querySelectorAll('.rtnum,.rt0,.rout,.r21btn').forEach(function(e){e.classList.remove('on');});el.classList.add('on');uw('roul');
}
function playRoul(){
  var amt=iv('roa');if(!chk(amt)||rSpinning)return;
  rSpinning=true;document.getElementById('robtn').disabled=true;
  document.getElementById('ror').style.display='none';document.getElementById('roulres').innerHTML='';document.getElementById('robtn').textContent='⏳ Spinning…';
  var ball=~~(Math.random()*37),resultIdx=RWHEEL.indexOf(ball),SEG=2*Math.PI/37;
  var targetWheel=rWheelAngle+Math.PI*(10+Math.random()*4);
  var winAngle=targetWheel+resultIdx*SEG-Math.PI/2+SEG/2;
  var startWheel=rWheelAngle,dur=5000,start=Date.now(),initBall=winAngle+12*Math.PI;
  rSpinSound(dur);
  var OR=Math.min(rCanvas.width,rCanvas.height)/2-5;
  var outerBR=OR*0.97,innerBR=OR*0.77;
  cancelAnimationFrame(rAnimId);
  (function frame(){
    var el=Date.now()-start,prog=Math.min(el/dur,1),ease=1-Math.pow(1-prog,3);
    rWheelAngle=startWheel+(targetWheel-startWheel)*ease;
    var ballR=outerBR+(innerBR-outerBR)*Math.min(1,Math.max(0,(prog-0.3)/0.7));
    rDrawFrame(rWheelAngle,initBall-ease*12*Math.PI,ballR,0);
    if(prog<1){rAnimId=requestAnimationFrame(frame);return;}
    rSpinning=false;document.getElementById('robtn').disabled=false;document.getElementById('robtn').textContent='🎡 SPIN WHEEL';
    rWinIdx=resultIdx;
    var col=ball===0?'#10b981':(RREDS.indexOf(ball)>=0?'#ef4444':'#e5e7eb');
    var cname=ball===0?'Green':RREDS.indexOf(ball)>=0?'Red':'Black';
    document.getElementById('roulres').innerHTML='<span style="color:'+col+';font-size:34px;font-weight:900">'+ball+'</span> <span style="font-size:14px;color:'+col+'">'+cname+'</span>';
    var mult=0;
    if(rSel<=36&&ball===rSel)mult=36;
    else if(rSel===37&&ball>0&&RREDS.indexOf(ball)>=0)mult=2;
    else if(rSel===38&&ball>0&&RREDS.indexOf(ball)<0)mult=2;
    else if(rSel===39&&ball>0&&ball%2===1)mult=2;
    else if(rSel===40&&ball>0&&ball%2===0)mult=2;
    else if(rSel===41&&ball>=1&&ball<=18)mult=2;
    else if(rSel===42&&ball>=19&&ball<=36)mult=2;
    else if(rSel===43&&ball>=1&&ball<=12)mult=3;
    else if(rSel===44&&ball>=13&&ball<=24)mult=3;
    else if(rSel===45&&ball>=25&&ball<=36)mult=3;
    else if(rSel===46&&ball>0&&ball%3===0)mult=3;
    else if(rSel===47&&ball>0&&ball%3===2)mult=3;
    else if(rSel===48&&ball>0&&ball%3===1)mult=3;
    if(mult>0){var p=Math.floor(amt*mult);BAL+=p-amt;updBal();showRes('ror',true,p-amt,'Ball '+ball+' ('+cname+')');showWin(p,'Roulette');}
    else{BAL-=amt;updBal();showRes('ror',false,0,'Ball '+ball+' ('+cname+') — no match');toast('❌ -'+amt.toLocaleString()+' sat','er');}
    // flash winning segment for ~50 frames then resume idle
    var flashCount=0;
    (function flashIdle(){
      flashCount++;
      rDrawFrame(rWheelAngle,winAngle,innerBR,flashCount);
      if(flashCount<50){rAnimId=requestAnimationFrame(flashIdle);return;}
      rWinIdx=-1;
      (function idle(){if(rSpinning)return;rWheelAngle+=0.003;rDrawFrame(rWheelAngle,0,0,0);rAnimId=requestAnimationFrame(idle);})();
    })();
  })();
}

// ─── PLINKO ───────────────────────────────────────────────────────────────────
function pkPS(W){return(W*0.82)/PKROWS;}
function pkPX(r,c,W){return W/2-(r*pkPS(W)/2)+c*pkPS(W);}
function pkPY(r,H){var tp=H*0.07,bpH=H*0.20;return tp+(r+0.5)*((H-tp-bpH)/PKROWS);}
function pkBX(b,W){return W/2-(PKROWS*pkPS(W)/2)+b*pkPS(W);}
function multColor(m){
  if(m>=100)return'#d946ef';
  if(m>=10)return'#ef4444';
  if(m>=5)return'#f97316';
  if(m>=2)return'#eab308';
  if(m>=1)return'#22c55e';
  return'#3b82f6';
}
function pkRR(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function pkDrawStatic(flashMap,landMap){
  if(!pkCtx||!pkCanvas)return;
  var W=pkCanvas.width,H=pkCanvas.height,ctx=pkCtx,ps=pkPS(W);
  var bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#06040f');bg.addColorStop(1,'#0a0a1c');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // Pegs
  for(var r=0;r<PKROWS;r++){
    for(var c=0;c<=r;c++){
      var px=pkPX(r,c,W),py=pkPY(r,H);
      var key=r+','+c,fl=flashMap&&flashMap[key];
      ctx.beginPath();ctx.arc(px,py,fl?6:4,0,Math.PI*2);
      ctx.fillStyle=fl?'#f7931a':'rgba(255,255,255,0.72)';
      ctx.shadowColor=fl?'#f7931a':'rgba(255,255,255,0.2)';
      ctx.shadowBlur=fl?18:4;ctx.fill();ctx.shadowBlur=0;
    }
  }
  // Buckets
  var mults=PKMULTS[PKROWS][pkRisk],bH=H*0.075,bY=H-(H*0.20)*0.88,bW=ps*0.84;
  mults.forEach(function(m,i){
    var bx=pkBX(i,W),col=multColor(m),lit=landMap&&landMap[i];
    ctx.fillStyle=lit?col+'55':col+'22';ctx.strokeStyle=lit?col:col+'99';
    ctx.lineWidth=lit?2:1.5;
    if(lit){ctx.shadowColor=col;ctx.shadowBlur=14;}
    pkRR(ctx,bx-bW/2,bY,bW,bH,4);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.font='bold '+Math.max(7,Math.min(11,ps*0.27))+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(m+'×',bx,bY+bH/2);
  });
}
// ── Plinko physics constants
var PKGRAV=0.19,PKDRAG=0.998,PKREST=0.44,PKSTEPS=3,PKBR=4.2,PKPR=4.5;
var pkPegs=[];
function pkBuildPegs(W,H){
  pkPegs=[];
  for(var r=0;r<PKROWS;r++){for(var c=0;c<=r;c++){pkPegs.push({x:pkPX(r,c,W),y:pkPY(r,H),r:r,c:c});}}
}
function pkHitPeg(ball,peg){
  var dx=ball.x-peg.x,dy=ball.y-peg.y;
  var d=Math.sqrt(dx*dx+dy*dy),md=PKBR+PKPR;
  if(d<md&&d>0.001){
    var nx=dx/d,ny=dy/d;
    // positional correction — push ball out of peg
    ball.x=peg.x+nx*md;ball.y=peg.y+ny*md;
    // velocity: reflect normal component with restitution
    var dot=ball.vx*nx+ball.vy*ny;
    if(dot<0){
      ball.vx-=(1+PKREST)*dot*nx;
      ball.vy-=(1+PKREST)*dot*ny;
      // tangential friction
      var tx=-ny,ty=nx,tang=ball.vx*tx+ball.vy*ty;
      ball.vx-=tang*tx*0.11;ball.vy-=tang*ty*0.11;
      // slight random kick — simulates imperfect pin surface
      ball.vx+=(Math.random()-0.5)*1.5;
    }
    ball.fp[peg.r+','+peg.c]=9;// flash for 9 frames
  }
}
function pkPhysics(ball,W,H){
  if(ball.done)return;
  var botY=H-(H*0.20)*0.72;
  // Once ball enters bucket zone, damp hard and settle
  if(ball.y>botY){
    ball.vx*=0.78;ball.vy*=0.78;
    ball.settleTimer=(ball.settleTimer||0)+1;
    if(ball.settleTimer>55||(Math.abs(ball.vx)<0.2&&Math.abs(ball.vy)<0.2)){
      ball.done=true;ball.doneTime=performance.now();
      var ps=pkPS(W),b=Math.round((ball.x-(W/2-PKROWS*ps/2))/ps);
      ball.bucket=Math.max(0,Math.min(PKROWS,b));
    }
    ball.trail.push({x:ball.x,y:ball.y});if(ball.trail.length>12)ball.trail.shift();
    return;
  }
  // Per-frame drag applied once
  ball.vx*=PKDRAG;ball.vy*=PKDRAG;
  // Sub-step integration: smaller dt = stable collisions
  var gs=PKGRAV/PKSTEPS,margin=W*0.038+PKBR;
  for(var s=0;s<PKSTEPS;s++){
    ball.vy+=gs;
    ball.x+=ball.vx/PKSTEPS;ball.y+=ball.vy/PKSTEPS;
    // Side walls
    if(ball.x<margin){ball.x=margin;ball.vx=Math.abs(ball.vx)*0.5;}
    if(ball.x>W-margin){ball.x=W-margin;ball.vx=-Math.abs(ball.vx)*0.5;}
    // Collide only pegs within vertical range of ball (fast path)
    for(var i=0;i<pkPegs.length;i++){
      if(Math.abs(pkPegs[i].y-ball.y)<PKBR+PKPR+10)pkHitPeg(ball,pkPegs[i]);
    }
  }
  // Decrement flash-peg timers
  for(var k in ball.fp){ball.fp[k]--;if(ball.fp[k]<=0)delete ball.fp[k];}
  // Sample trail once per frame
  ball.trail.push({x:ball.x,y:ball.y});if(ball.trail.length>12)ball.trail.shift();
}
function pkMakeBall(W,H,amt){
  return{x:W/2+(Math.random()-0.5)*1.5,y:pkPY(0,H)-H*0.065,
    vx:(Math.random()-0.5)*0.5,vy:0.6,
    trail:[],fp:{},bucket:-1,done:false,doneTime:0,paid:false,settleTimer:0,amt:amt};
}
function pkFrame(){
  if(!pkCtx||!pkCanvas)return;
  var now=performance.now(),W=pkCanvas.width,H=pkCanvas.height;
  var mults=PKMULTS[PKROWS][pkRisk];
  // Physics update for every live ball
  pkActiveBalls.forEach(function(b){pkPhysics(b,W,H);});
  // Collect flash + land state
  var flashMap={},landMap={};
  pkActiveBalls.forEach(function(b){
    if(!b.done){for(var k in b.fp){if(b.fp[k]>0)flashMap[k]=true;}}
    if(b.done&&b.paid&&b.bucket>=0)landMap[b.bucket]=(landMap[b.bucket]||0)+1;
  });
  // Draw board (background + pegs + buckets)
  pkDrawStatic(flashMap,landMap);
  var ctx=pkCtx;
  // Draw balls + trails
  pkActiveBalls.forEach(function(b){
    if(b.done)return;
    // Fading trail
    for(var ti=0;ti<b.trail.length;ti++){
      var tp=b.trail[ti],al=(ti+1)/b.trail.length*0.26,rad=1.5+(ti/b.trail.length)*5;
      ctx.beginPath();ctx.arc(tp.x,tp.y,rad,0,Math.PI*2);
      ctx.fillStyle='rgba(251,191,36,'+al+')';ctx.fill();
    }
    // Ball — radial gradient with glow
    var gr=ctx.createRadialGradient(b.x-2,b.y-2,0,b.x,b.y,8);
    gr.addColorStop(0,'rgba(255,255,255,0.95)');gr.addColorStop(0.38,'#fde68a');
    gr.addColorStop(0.72,'#f59e0b');gr.addColorStop(1,'#d97706');
    ctx.beginPath();ctx.arc(b.x,b.y,8,0,Math.PI*2);
    ctx.fillStyle=gr;ctx.shadowColor='#fbbf24';ctx.shadowBlur=20;ctx.fill();ctx.shadowBlur=0;
    // Ball specular highlight
    ctx.beginPath();ctx.arc(b.x-2.5,b.y-2.5,2.5,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fill();
  });
  // Pay out settled balls — aggregate, only announce when last ball lands
  pkActiveBalls.forEach(function(b){
    if(b.done&&!b.paid){
      b.paid=true;
      var m=mults[b.bucket]||0.2,p=Math.floor(b.amt*m);BAL+=p;updBal();
      pkDropProfit+=p;
      pkDropPending=Math.max(0,pkDropPending-1);
      if(pkDropPending<=0){
        var net=pkDropProfit-pkDropCost;
        if(net>0){showRes('pkr',true,net,'Net win: +'+net.toLocaleString()+' sat');showWin(pkDropProfit,'Plinko');}
        else if(net===0){showRes('pkr',true,0,'Break even');}
        else{showRes('pkr',false,-net,'Net loss: '+net.toLocaleString()+' sat');toast('❌ '+net.toLocaleString()+' sat','er');}
      }
    }
  });
  pkActiveBalls=pkActiveBalls.filter(function(b){return!b.done||now-b.doneTime<1000;});
  if(pkActiveBalls.length>0){pkAnimId=requestAnimationFrame(pkFrame);}else{pkAnimId=null;}
}
function setPkRows(n,el){PKROWS=n;document.querySelectorAll('#pkrowsel .dtt').forEach(function(t){t.classList.remove('on');});el.classList.add('on');pkActiveBalls=[];cancelAnimationFrame(pkAnimId);pkAnimId=null;if(pkCanvas&&pkCtx){pkBuildPegs(pkCanvas.width,pkCanvas.height);pkDrawStatic(null,null);}}
function setPkRisk(r,el){pkRisk=r;document.querySelectorAll('#pkrisksel .dtt').forEach(function(t){t.classList.remove('on');});el.classList.add('on');pkActiveBalls=[];if(pkCanvas&&pkCtx)pkDrawStatic(null,null);}
function setPkBN(n,el){pkBallsN=n;document.querySelectorAll('#pkballsel .dtt').forEach(function(t){t.classList.remove('on');});el.classList.add('on');}
function openPlinko(){
  PKROWS=16;pkRisk='low';pkBallsN=1;pkActiveBalls=[];
  var mH='<div id="pkwrap" style="width:100%;height:100%;background:linear-gradient(160deg,#06040f,#0a0a1c)">'
    +'<canvas id="pk-cv" style="width:100%;height:100%;display:block"></canvas>'
    +'</div>';
  var cH='<div class="cl">Rows</div>'
    +'<div class="dtog" id="pkrowsel">'
    +'<div class="dtt" onclick="setPkRows(8,this)">8</div>'
    +'<div class="dtt" onclick="setPkRows(10,this)">10</div>'
    +'<div class="dtt" onclick="setPkRows(12,this)">12</div>'
    +'<div class="dtt on" onclick="setPkRows(16,this)">16</div>'
    +'</div>'
    +'<div class="cl" style="margin-top:6px">Risk</div>'
    +'<div class="dtog" id="pkrisksel">'
    +'<div class="dtt on" onclick="setPkRisk(\'low\',this)" style="color:#22c55e;font-weight:800">Low</div>'
    +'<div class="dtt" onclick="setPkRisk(\'med\',this)" style="color:#eab308;font-weight:800">Med</div>'
    +'<div class="dtt" onclick="setPkRisk(\'high\',this)" style="color:#ef4444;font-weight:800">High</div>'
    +'</div>'
    +'<div class="cl" style="margin-top:6px">Bet (sat)</div>'
    +'<input class="ci" type="number" id="pka" value="10000" min="1000" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'pka\',1000)">1k</div><div class="qb" onclick="sa2(\'pka\',5000)">5k</div><div class="qb" onclick="sa2(\'pka\',10000)">10k</div><div class="qb" onclick="sa2(\'pka\',50000)">50k</div><div class="qb" onclick="sa2(\'pka\',Math.floor(BAL/2))">½</div><div class="qb" onclick="sa2(\'pka\',BAL)">MAX</div></div>'
    +'<div class="cl" style="margin-top:6px">Balls per drop</div>'
    +'<div class="dtog" id="pkballsel">'
    +'<div class="dtt on" onclick="setPkBN(1,this)">×1</div>'
    +'<div class="dtt" onclick="setPkBN(3,this)">×3</div>'
    +'<div class="dtt" onclick="setPkBN(5,this)">×5</div>'
    +'<div class="dtt" onclick="setPkBN(10,this)">×10</div>'
    +'</div>'
    +'<button class="bplay" id="pkbtn" onclick="dropPlinko()" style="margin-top:auto">🔮 DROP BALL</button>'
    +'<div class="res" id="pkr" style="text-align:center;margin-top:4px"></div>';
  openFSOv('🔮','Plinko',mH,cH,function(){
    pkCanvas=document.getElementById('pk-cv');if(!pkCanvas)return;
    var wrap=document.getElementById('pkwrap');
    pkCanvas.width=wrap.offsetWidth||460;
    pkCanvas.height=wrap.offsetHeight||620;
    pkCtx=pkCanvas.getContext('2d');
    pkBuildPegs(pkCanvas.width,pkCanvas.height);
    pkDrawStatic(null,null);
  });
}
function dropPlinko(){
  var amt=iv('pka');if(amt<1000){toast('Min bet: 1,000 sat','er');return;}
  var total=amt*pkBallsN;if(total>BAL){toast('Insufficient balance','er');return;}
  if(!pkCanvas||!pkCtx)return;
  BAL-=total;updBal();
  pkDropPending=pkBallsN;pkDropProfit=0;pkDropCost=total;
  var W=pkCanvas.width,H=pkCanvas.height;
  pkBuildPegs(W,H);// ensure peg cache is fresh
  for(var i=0;i<pkBallsN;i++){
    (function(delay){
      setTimeout(function(){
        pkActiveBalls.push(pkMakeBall(W,H,amt));
        if(!pkAnimId)pkAnimId=requestAnimationFrame(pkFrame);
      },delay);
    }(i*320));
  }
}

// ─── SLOTS ────────────────────────────────────────────────────────────────────
function slPullHandle(){
  if(slSpinning)return;
  var h=document.getElementById('slhandle');
  if(h)h.classList.add('pulled'); // stays down until spin finishes
  slPullSound();
  playSlots();
}
function slRollSound(ri){
  try{
    if(!rAudioCtx){rAudioCtx=new(window.AudioContext||window.webkitAudioContext)();}
    var now=rAudioCtx.currentTime+ri*0.1;
    for(var i=0;i<22;i++){
      var prog=i/22;
      var t=now+prog*prog*0.52;
      var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
      o.connect(g);g.connect(rAudioCtx.destination);
      o.type='square';o.frequency.value=120+Math.random()*100;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.05,t+0.006);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.04);
      o.start(t);o.stop(t+0.05);
    }
    var st=now+0.58;
    var o2=rAudioCtx.createOscillator(),g2=rAudioCtx.createGain();
    o2.connect(g2);g2.connect(rAudioCtx.destination);
    o2.type='triangle';o2.frequency.value=100+ri*14;
    g2.gain.setValueAtTime(0,st);g2.gain.linearRampToValueAtTime(0.28,st+0.008);
    g2.gain.exponentialRampToValueAtTime(0.001,st+0.14);
    o2.start(st);o2.stop(st+0.18);
  }catch(e){}
}
function slPullSound(){
  try{
    if(!rAudioCtx){rAudioCtx=new(window.AudioContext||window.webkitAudioContext)();}
    var now=rAudioCtx.currentTime;
    var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
    o.connect(g);g.connect(rAudioCtx.destination);
    o.type='square';
    o.frequency.setValueAtTime(220,now);
    o.frequency.exponentialRampToValueAtTime(55,now+0.2);
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(0.38,now+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
    o.start(now);o.stop(now+0.28);
  }catch(e){}
}
function slAmbientStart(){
  try{
    if(!rAudioCtx){rAudioCtx=new(window.AudioContext||window.webkitAudioContext)();}
    if(slAmbId){slAmbId.oscs.forEach(function(o){try{o.stop();}catch(e){}});slAmbId=null;}
    // Rich layered machine hum: fundamental + 2 harmonics through shared filter
    var flt=rAudioCtx.createBiquadFilter();
    var masterGain=rAudioCtx.createGain();
    flt.type='lowpass';flt.frequency.value=280;
    masterGain.gain.value=1;
    flt.connect(masterGain);masterGain.connect(rAudioCtx.destination);
    var humSpecs=[[55,0.04],[110,0.018],[164.8,0.008]];
    var oscs=humSpecs.map(function(spec){
      var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
      o.type='triangle';o.frequency.value=spec[0];g.gain.value=spec[1];
      o.connect(g);g.connect(flt);o.start();return o;
    });
    slAmbId={oscs:oscs,gain:masterGain};
    // Casino fanfare: 8-note C major arpeggio (C4→E4→G4→C5→E5→G5→C6→E6)
    var fanfare=[261.6,329.6,392,523.2,659.3,784,1046.5,1318.5];
    fanfare.forEach(function(freq,i){
      var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
      o.connect(g);g.connect(rAudioCtx.destination);
      o.type='sine';o.frequency.value=freq;
      var peak=i>=6?0.28:0.2;
      var t=rAudioCtx.currentTime+0.05+i*0.09;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+0.03);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.38);
      o.start(t);o.stop(t+0.42);
    });
    // Soft chord accent on last beat (C6+E6+G6 together, delayed)
    [1046.5,1318.5,1568].forEach(function(freq){
      var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
      o.connect(g);g.connect(rAudioCtx.destination);
      o.type='sine';o.frequency.value=freq;
      var t=rAudioCtx.currentTime+0.05+7*0.09+0.12;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.14,t+0.04);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
      o.start(t);o.stop(t+0.65);
    });
  }catch(e){}
}
function slAmbientStop(){
  if(!slAmbId)return;
  try{
    var g=slAmbId.gain;
    if(rAudioCtx)g.gain.linearRampToValueAtTime(0,rAudioCtx.currentTime+0.35);
    var oscs=slAmbId.oscs;
    setTimeout(function(){oscs.forEach(function(o){try{o.stop();}catch(e){}});},400);
    slAmbId=null;
  }catch(e){slAmbId=null;}
}
function slWinSound(total){
  try{
    if(!rAudioCtx){rAudioCtx=new(window.AudioContext||window.webkitAudioContext)();}
    var now=rAudioCtx.currentTime;
    // Shimmer on every win (crystal high note)
    var shimFreqs=total>=100?[2093,4186]:[2093];
    shimFreqs.forEach(function(freq,i){
      var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
      o.connect(g);g.connect(rAudioCtx.destination);
      o.type='triangle';o.frequency.value=freq;
      var t=now+i*0.08;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.06,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
      o.start(t);o.stop(t+0.65);
    });
    if(total>=100){
      // Big win: C major triad chord hits together, then soaring peak
      [[523.2,0],[659.3,0],[784,0],[1046.5,0.22],[1318.5,0.38]].forEach(function(spec){
        var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
        o.connect(g);g.connect(rAudioCtx.destination);
        o.type=spec[1]>0.3?'triangle':'sine';o.frequency.value=spec[0];
        var t=now+spec[1];
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.32,t+0.04);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.65);
        o.start(t);o.stop(t+0.7);
      });
      // Final triumphant chord E6+G6 together
      [1318.5,1568].forEach(function(f){
        var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
        o.connect(g);g.connect(rAudioCtx.destination);
        o.type='sine';o.frequency.value=f;
        var t=now+0.55;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.22,t+0.05);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.7);
        o.start(t);o.stop(t+0.8);
      });
    }else if(total>=30){
      // Medium win: warm 5-note arpeggio with triangle wave
      [523.2,659.3,784,1046.5,1318.5].forEach(function(f,i){
        var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
        o.connect(g);g.connect(rAudioCtx.destination);
        o.type='triangle';o.frequency.value=f;
        var t=now+i*0.11;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.26,t+0.03);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        o.start(t);o.stop(t+0.55);
      });
    }else{
      // Small win: crisp 3-note ping (E5→G5→C6)
      [659.3,784,1046.5].forEach(function(f,i){
        var o=rAudioCtx.createOscillator(),g=rAudioCtx.createGain();
        o.connect(g);g.connect(rAudioCtx.destination);
        o.type='sine';o.frequency.value=f;
        var t=now+i*0.12;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.24,t+0.03);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.45);
        o.start(t);o.stop(t+0.5);
      });
    }
  }catch(e){}
}
function slSpawnParticles(){
  var c=document.getElementById('slpcont');if(!c)return;
  var colors=['#f7931a','#fbbf24','#10b981','#60a5fa','#c084fc','#ff6b6b','#34d399','#a78bfa','#fff','#f472b6'];
  for(var i=0;i<55;i++){
    var p=document.createElement('div');
    var sz=3+Math.random()*10;
    var dur=(0.6+Math.random()*1.2).toFixed(2);
    var del=(Math.random()*0.4).toFixed(2);
    var col=colors[Math.floor(Math.random()*colors.length)];
    var dx=Math.round(Math.random()*260-130);
    var dy=Math.round(-90-Math.random()*160);
    var dr=Math.round(Math.random()*720-360);
    p.style.cssText='position:absolute;width:'+sz+'px;height:'+sz+'px;'
      +'left:'+(5+Math.random()*90)+'%;bottom:10%;'
      +'background:'+col+';'
      +'border-radius:'+(Math.random()>.45?'50%':'3px')+';'
      +'animation:slParticle '+dur+'s '+del+'s ease-out both;'
      +'--dx:'+dx+'px;--dy:'+dy+'px;--dr:'+dr+'deg;'
      +'pointer-events:none;z-index:20';
    c.appendChild(p);
    setTimeout(function(el){return function(){if(el.parentNode)el.parentNode.removeChild(el);};}(p),(+dur+ +del)*1000+200);
  }
}
function openSlots(){
  var REEL='<div class="srcol"><div class="srtrack" id="sr';
  var mH='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:8px">'
    +'<div class="sl-machine-row" style="width:100%;max-width:760px;justify-content:center">'
    +'<div class="smach" id="sl-machine" style="flex:1;max-width:680px">'
    +'<div class="smtop" style="font-size:16px;padding:8px 0">₿ ✦ CRYPTO SLOTS ✦ ₿</div>'
    +'<div class="sreels" id="sreels-wrap">'
    +REEL+'0"></div></div>'
    +REEL+'1"></div></div>'
    +REEL+'2"></div></div>'
    +REEL+'3"></div></div>'
    +REEL+'4"></div></div>'
    +'<div class="spl-zone"></div>'
    +'<div class="spl1" id="spl1"></div>'
    +'<div class="sl-glass"></div>'
    +'<div id="slpcont" style="position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:15"></div>'
    +'</div>'
    +'<div class="sline" id="sline" style="min-height:22px"></div>'
    +'<div class="scred" id="scred"></div>'
    +'</div>'
    +'<div class="sl-handle-outer">'
    +'<div class="sl-handle-track">'
    +'<div class="sl-handle" id="slhandle" onclick="slPullHandle()" title="Pull to spin!">'
    +'<div class="sl-handle-ball"></div>'
    +'</div>'
    +'</div>'
    +'<div class="sl-handle-base"></div>'
    +'</div>'
    +'</div></div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="sla" value="10000" min="1000" oninput="uw(\'slots\')" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'sla\',1000);uw(\'slots\')">1k</div><div class="qb" onclick="sa2(\'sla\',5000);uw(\'slots\')">5k</div><div class="qb" onclick="sa2(\'sla\',10000);uw(\'slots\')">10k</div><div class="qb" onclick="sa2(\'sla\',50000);uw(\'slots\')">50k</div><div class="qb" onclick="sa2(\'sla\',Math.floor(BAL/2));uw(\'slots\')">½</div><div class="qb" onclick="sa2(\'sla\',BAL);uw(\'slots\')">MAX</div></div>'
    +'<div class="cl">Max Win (200×)</div><input class="ci wv" readonly id="slw" style="width:100%">'
    +'<div class="cl" style="font-size:10px;color:rgba(255,255,255,.4)">1 PAYLINE · 5 REELS · 3+ TO WIN</div>'
    +'<div class="ptbl"><div class="ph">PAYOUT TABLE</div>'
    +'<div class="pr"><span>₿ × 5</span><span style="color:#f7931a">200×</span></div>'
    +'<div class="pr"><span>₿ × 4</span><span style="color:#f7931a">50×</span></div>'
    +'<div class="pr"><span>₿ × 3</span><span style="color:#f7931a">10×</span></div>'
    +'<div class="pr"><span>🐱 CAT × 5</span><span style="color:#e8c77a">100×</span></div>'
    +'<div class="pr"><span>🐱 CAT × 3</span><span style="color:#e8c77a">6×</span></div>'
    +'<div class="pr"><span>OP × 5</span><span style="color:#9945ff">50×</span></div>'
    +'<div class="pr"><span>OP × 3</span><span style="color:#9945ff">4×</span></div>'
    +'<div class="pr"><span>♦ × 5</span><span style="color:#26a17b">30×</span></div>'
    +'<div class="pr"><span>♦ × 3</span><span style="color:#26a17b">3×</span></div>'
    +'<div class="pr"><span>🟠 PILL × 5</span><span style="color:#f7931a">20×</span></div>'
    +'<div class="pr"><span>🟠 PILL × 3</span><span style="color:#f7931a">2×</span></div>'
    +'<div class="pr"><span>★ × 3</span><span style="color:#f5c518">1×</span></div>'
    +'</div>'
    +'<button class="bplay" id="slbtn" onclick="slPullHandle()" style="margin-top:auto">🎰 PULL TO SPIN</button>'
    +'<div class="res" id="slr" style="text-align:center"></div>';
  openFSOv('🎰','Crypto Slots',mH,cH,function(){initSlots();uw('slots');slAmbientStart();});
}
function initSlots(){
  for(var r=0;r<5;r++){
    var tr=document.getElementById('sr'+r);if(!tr)return;
    var h='';
    for(var i=0;i<15;i++){var s=Math.floor(Math.random()*6);h+='<div class="ssym '+SCLS[s]+'">'+SSYMS[s]+'</div>';}
    tr.innerHTML=h;tr.style.transition='none';tr.style.top='0';
  }
  var cr=document.getElementById('scred');if(cr)cr.textContent='Credits: '+BAL.toLocaleString()+' sat';
  uw('slots');
}
function wSlots5(grid){
  var base=grid[0][1],count=1;
  for(var r=1;r<5;r++){if(grid[r][1]===base)count++;else break;}
  if(count>=3){var m=SPAY[base][count-3];return{total:m,wins:[{pl:1,sym:base,count:count,mult:m}]};}
  return{total:0,wins:[]};
}
function playSlots(){
  var amt=iv('sla');if(!chk(amt)||slSpinning)return;
  slSpinning=true;BAL-=amt;updBal();
  var btn=document.getElementById('slbtn');if(btn)btn.disabled=true;
  var res=document.getElementById('slr');if(res)res.style.display='none';
  var sl=document.getElementById('sline');if(sl)sl.textContent='';
  var sp=document.getElementById('spl1');if(sp)sp.classList.remove('spayline');
  var mach=document.getElementById('sl-machine');if(mach)mach.classList.remove('sl-win');
  // grid[reel][row]: 0=top,1=mid,2=bot
  // Track: 24 random + 3 finals + 3 trailing random = 30 symbols (no visible end)
  var grid=[];
  for(var r=0;r<5;r++)grid.push([Math.floor(Math.random()*6),Math.floor(Math.random()*6),Math.floor(Math.random()*6)]);
  var cellH=80,FIDX=24; // finals at indices 24,25,26
  var P1_DUR=720,P2_DUR=950; // slower, more satisfying
  var p1Stop=-20*cellH; // -1600px: fast phase stops here
  var finalTop=-FIDX*cellH;  // -1920px: finals visible
  [0,1,2,3,4].forEach(function(ri){
    var tr=document.getElementById('sr'+ri);if(!tr)return;
    var col=tr.parentNode;
    // Build 30-symbol track: 24 random + top,mid,bot finals + 3 trailing random
    var syms=[];
    for(var i=0;i<FIDX;i++)syms.push(Math.floor(Math.random()*6));
    syms.push(grid[ri][0]);syms.push(grid[ri][1]);syms.push(grid[ri][2]);
    for(var j=0;j<3;j++)syms.push(Math.floor(Math.random()*6)); // trailing: no visible end
    tr.innerHTML=syms.map(function(s){return '<div class="ssym '+SCLS[s]+'">'+SSYMS[s]+'</div>';}).join('');
    tr.style.transition='none';tr.style.top='0';
    // Dramatic left-to-right stagger: each reel starts, spins, and lands later than previous
    var p1d=P1_DUR+ri*80;   // 720→1040ms per reel
    var p2d=P2_DUR+ri*140;  // 950→1510ms: rightmost reel lands slowest
    var sd=ri*160+25;        // 25→665ms start delay
    if(col)col.classList.add('sl-spin');
    slRollSound(ri); // reel-specific click+thunk sounds
    setTimeout(function(t,c,d1,d2){return function(){
      t.style.transition='top '+d1+'ms linear';
      t.style.top=p1Stop+'px'; // phase 1: fast roll
      setTimeout(function(){
        if(c){c.classList.remove('sl-spin');c.classList.add('sl-land');}
        // phase 2: decelerate into final with slight mechanical bounce
        t.style.transition='top '+d2+'ms cubic-bezier(.12,1.18,.38,1)';
        t.style.top=finalTop+'px';
        setTimeout(function(){if(c)c.classList.remove('sl-land');},d2+60);
      },d1+10);
    };}(tr,col,p1d,p2d),sd);
  });
  // totalMs = last reel's full journey + result reveal buffer
  var totalMs=(4*160+25)+(P1_DUR+4*80)+10+(P2_DUR+4*140)+500;
  setTimeout(function(){
    slSpinning=false;
    var h=document.getElementById('slhandle');if(h)h.classList.remove('pulled'); // handle returns up
    var btn2=document.getElementById('slbtn');if(btn2)btn2.disabled=false;
    var sl2=document.getElementById('sline');
    var result=wSlots5(grid);
    if(result.total>0){
      var p=Math.floor(amt*result.total);BAL+=p;updBal();
      var mach2=document.getElementById('sl-machine');if(mach2)mach2.classList.add('sl-win');
      result.wins.forEach(function(w){var pd=document.getElementById('spl'+w.pl);if(pd)pd.classList.add('spayline');});
      var wdesc=result.wins.map(function(w){return SNAMES[w.sym]+'×'+w.count+' ('+w.mult+'×)';}).join(' + ');
      if(sl2)sl2.textContent='🏆 '+result.total+'× WIN! +'+p.toLocaleString()+' sat!';
      slWinSound(result.total);
      slSpawnParticles();
      showRes('slr',true,p-amt,wdesc);showWin(p,'Slots');
    }else{
      if(sl2)sl2.textContent='No match — try again!';
      var sym5=grid.map(function(rr){return SNAMES[rr[1]];}).join(' ');
      showRes('slr',false,0,sym5+' — no win');toast('❌ -'+amt.toLocaleString()+' sat','er');
    }
    var cr=document.getElementById('scred');if(cr)cr.textContent='Credits: '+BAL.toLocaleString()+' sat';
  },totalMs);
}

// ─── MINES ────────────────────────────────────────────────────────────────────
function openMines(){
  mnMines=3;mnActive=false;mnGrid=[];mnRevealed=0;
  var mH='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px">'
    +'<div class="mnMult" id="mmult">0.00×</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;width:min(100%,440px)">'
    +'<span id="minfo1">Choose mines count then start</span><span id="minfo2" style="color:#f7931a">Profit: 0 sat</span>'
    +'</div>'
    +'<div class="mn3g" id="mgrid"></div>'
    +'</div>';
  var cH='<div class="cl">Bet (sat)</div>'
    +'<input class="ci" type="number" id="mna" value="10000" min="1000" style="width:100%">'
    +'<div class="qs"><div class="qb" onclick="sa2(\'mna\',1000)">1k</div><div class="qb" onclick="sa2(\'mna\',5000)">5k</div><div class="qb" onclick="sa2(\'mna\',10000)">10k</div><div class="qb" onclick="sa2(\'mna\',50000)">50k</div><div class="qb" onclick="sa2(\'mna\',Math.floor(BAL/2))">½</div></div>'
    +'<div class="cl" style="margin-top:4px">Mines Count</div>'
    +'<div class="msel">'
    +'<div class="msb" onclick="setMines(1,this)">1 💣</div>'
    +'<div class="msb on" onclick="setMines(3,this)">3 💣</div>'
    +'<div class="msb" onclick="setMines(5,this)">5 💣</div>'
    +'<div class="msb" onclick="setMines(8,this)">8 💣</div>'
    +'<div class="msb" onclick="setMines(12,this)">12 💣</div>'
    +'<div class="msb" onclick="setMines(20,this)">20 💣</div>'
    +'</div>'
    +'<div class="ptbl"><div class="ph">WIN PREVIEW</div>'
    +'<div class="pr"><span>After 1st gem</span><span id="mnw1">--</span></div>'
    +'<div class="pr"><span>After 3rd gem</span><span id="mnw3">--</span></div>'
    +'<div class="pr"><span>After 5th gem</span><span id="mnw5">--</span></div>'
    +'</div>'
    +'<button class="bplay" id="mnbtn" onclick="startMines()" style="margin-top:auto">💣 START GAME</button>'
    +'<button class="bplay" id="mncash" onclick="cashMines()" style="display:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff">💰 CASH OUT NOW</button>'
    +'<div class="res" id="mnr" style="text-align:center"></div>';
  openFSOv('💣','Mines',mH,cH,function(){buildMinesGrid();updMinesOdds();});
}
function minesMult(mines,revealed){var p=1,tot=25;for(var i=0;i<revealed;i++){p*=(tot-mines-i)/(tot-i);}return parseFloat((0.97/p).toFixed(4));}
function updMinesOdds(){
  var bet=iv('mna')||10000;
  var m1=minesMult(mnMines,1),m3=minesMult(mnMines,3),m5=minesMult(mnMines,5);
  var e=function(id){return document.getElementById(id);};
  if(e('mnw1'))e('mnw1').textContent=m1.toFixed(2)+'× ('+Math.floor(bet*m1).toLocaleString()+' sat)';
  if(e('mnw3'))e('mnw3').textContent=m3.toFixed(2)+'× ('+Math.floor(bet*m3).toLocaleString()+' sat)';
  if(e('mnw5'))e('mnw5').textContent=m5.toFixed(2)+'× ('+Math.floor(bet*m5).toLocaleString()+' sat)';
}
function setMines(n,el){mnMines=n;document.querySelectorAll('.msb').forEach(function(b){b.classList.remove('on');});el.classList.add('on');updMinesOdds();}
function buildMinesGrid(){
  var grid=document.getElementById('mgrid');if(!grid)return;
  var h='';for(var i=0;i<25;i++){
    h+='<div class="mt3" id="mt'+i+'" onclick="clickTile('+i+')">'
      +'<div class="mt3-in"><div class="mt3-f">💠</div><div class="mt3-b" id="mtb'+i+'"></div></div></div>';
  }grid.innerHTML=h;
}
function startMines(){
  var amt=iv('mna');if(!chk(amt))return;
  mnBet=amt;BAL-=amt;updBal();mnActive=true;mnRevealed=0;
  mnGrid=new Array(25).fill(0);var placed=0;
  while(placed<mnMines){var idx=~~(Math.random()*25);if(!mnGrid[idx]){mnGrid[idx]=1;placed++;}}
  for(var i=0;i<25;i++){
    var t=document.getElementById('mt'+i),b=document.getElementById('mtb'+i);
    if(t){t.classList.remove('flp');t.classList.add('act');}
    if(b){b.className='mt3-b';b.textContent='';}
  }
  document.getElementById('mmult').textContent='1.00×';
  document.getElementById('minfo1').textContent=mnMines+' mines hidden — find the 💎 gems!';
  document.getElementById('minfo2').textContent='Profit: 0 sat';
  var btn=document.getElementById('mnbtn');if(btn)btn.style.display='none';
  var cash=document.getElementById('mncash');if(cash)cash.style.display='block';
  var res=document.getElementById('mnr');if(res)res.style.display='none';
}
function clickTile(idx){
  if(!mnActive)return;
  var t=document.getElementById('mt'+idx);if(!t||t.classList.contains('flp'))return;
  var back=document.getElementById('mtb'+idx);
  if(mnGrid[idx]===1){
    back.classList.add('bomb');back.textContent='💣';t.classList.add('flp');
    setTimeout(function(){
      for(var i=0;i<25;i++){if(mnGrid[i]===1&&i!==idx){var tb=document.getElementById('mtb'+i),tt=document.getElementById('mt'+i);if(tb&&tt&&!tt.classList.contains('flp')){tb.classList.add('bomb');tb.textContent='💣';setTimeout((function(ti){return function(){ti.classList.add('flp');};})(tt),Math.random()*500);}}}
    },150);
    mnActive=false;document.querySelectorAll('.mt3').forEach(function(t2){t2.classList.remove('act');});
    var btn=document.getElementById('mnbtn');if(btn){btn.style.display='block';btn.textContent='💣 NEW GAME';}
    var cash=document.getElementById('mncash');if(cash)cash.style.display='none';
    document.getElementById('mmult').textContent='0.00×';
    document.getElementById('minfo1').textContent='BOOM! Mine found.';
    showRes('mnr',false,0,'💥 Hit a mine! Lost '+mnBet.toLocaleString()+' sat');
    toast('💥 BOOM! Mine hit!','er');
  } else {
    back.classList.add('gem');back.textContent='💎';t.classList.add('flp');mnRevealed++;
    var m=minesMult(mnMines,mnRevealed);
    var profit=Math.max(0,Math.floor(mnBet*m)-mnBet);
    document.getElementById('mmult').textContent=m.toFixed(2)+'×';
    document.getElementById('minfo1').textContent=mnRevealed+' gem'+(mnRevealed>1?'s':'')+' found — keep going or cash out!';
    document.getElementById('minfo2').textContent='Profit: +'+(profit).toLocaleString()+' sat';
    var cash=document.getElementById('mncash');
    if(cash)cash.textContent='💰 Cash Out '+Math.floor(mnBet*m).toLocaleString()+' sat';
    if(mnRevealed===25-mnMines)cashMines();
  }
}
function cashMines(){
  if(!mnActive)return;mnActive=false;
  document.querySelectorAll('.mt3').forEach(function(t){t.classList.remove('act');});
  var m=minesMult(mnMines,mnRevealed),pay=Math.floor(mnBet*m);
  BAL+=pay;updBal();
  var btn=document.getElementById('mnbtn');if(btn){btn.style.display='block';btn.textContent='💣 NEW GAME';}
  var cash=document.getElementById('mncash');if(cash)cash.style.display='none';
  showRes('mnr',true,pay-mnBet,'Cashed out at '+m.toFixed(2)+'× after '+mnRevealed+' gems');
  showWin(pay,'Mines');
  setTimeout(function(){
    for(var i=0;i<25;i++){if(mnGrid[i]===0){var t=document.getElementById('mt'+i),tb=document.getElementById('mtb'+i);if(t&&!t.classList.contains('flp')&&tb){tb.className='mt3-b gem';tb.textContent='💎';setTimeout((function(ti){return function(){ti.classList.add('flp');};})(t),Math.random()*600);}}}
  },100);
}

// ─── SPORTS ───────────────────────────────────────────────────────────────────
function setSport(s){
  curSport=s;document.querySelectorAll('.spbtn').forEach(function(b){b.classList.remove('on');});
  var el=document.getElementById('sb-'+s);if(el)el.classList.add('on');
  var tit=document.getElementById('sptit');
  if(tit)tit.textContent=s==='soccer'?'⚽ Football':s==='nba'?'🏀 NBA':s==='nfl'?'🏈 NFL':'🎾 Tennis';
  loadSport(s);
}
function loadSport(sport){
  curSport=sport;var evl=document.getElementById('evl');if(!evl)return;
  evl.innerHTML='<div class="spload">⚡ Loading…</div>';
  var urls={soccer:'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',nba:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',nfl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',tennis:'https://site.api.espn.com/apis/site/v2/sports/tennis/scoreboard'};
  fetch(urls[sport]||urls.soccer)
  .then(function(r){return r.json();})
  .then(function(d){var evs=(d.events||[]).filter(function(e){return e.competitions&&e.competitions[0];});if(evs.length>0){liveEvs=evs;renderSport(evs);}else renderFallback(sport);})
  .catch(function(){renderFallback(sport);});
}
function renderSport(evs){
  var evl=document.getElementById('evl');if(!evl)return;
  var h='';evs.slice(0,10).forEach(function(ev){
    var c=ev.competitions[0],teams=c.competitors||[];
    var h1=teams[0]||{},h2=teams[1]||{};
    var n1=(h1.team||{}).shortDisplayName||'Team A',n2=(h2.team||{}).shortDisplayName||'Team B';
    var s1=h1.score||'0',s2=h2.score||'0';
    var live=(c.status||{}).type&&c.status.type.state==='in';
    var o1=(1.5+Math.random()*2).toFixed(2),od=(2.8+Math.random()*1.5).toFixed(2),o2=(1.4+Math.random()*2.2).toFixed(2);
    h+='<div class="ev"><div class="evh"><span class="'+(live?'ltag':'fttag')+'">'+(live?'LIVE':'FT')+'</span><span>'+ev.name+'</span></div>';
    h+='<div class="evt"><div class="etm">'+n1+'</div><div class="esc">'+s1+' — '+s2+'</div><div class="etm">'+n2+'</div></div>';
    h+='<div class="evos"><div class="ob" onclick="addSlip(\''+n1+'\','+o1+')"><div class="ol">Home</div><div class="ov">'+o1+'</div></div>';
    h+='<div class="ob" onclick="addSlip(\'Draw\','+od+')"><div class="ol">Draw</div><div class="ov">'+od+'</div></div>';
    h+='<div class="ob" onclick="addSlip(\''+n2+'\','+o2+')"><div class="ol">Away</div><div class="ov">'+o2+'</div></div></div></div>';
  });
  evl.innerHTML=h;
}
var FALLBACK={soccer:[['Man City','Arsenal','2-1'],['Liverpool','Chelsea','0-0'],['Real Madrid','Barcelona','3-2'],['PSG','Bayern','1-1'],['Juventus','AC Milan','2-0']],nba:[['Lakers','Celtics','108-112'],['Warriors','Heat','121-98'],['Nets','Bucks','89-105'],['76ers','Suns','116-110']],nfl:[['Chiefs','Eagles','24-17'],['Bills','Ravens','21-28'],['Cowboys','Rams','31-14']],tennis:[['Djokovic','Alcaraz','7-6,4-6,6-3'],['Swiatek','Gauff','6-4,7-5']]};
function renderFallback(sport){
  var evl=document.getElementById('evl');if(!evl)return;
  var data=FALLBACK[sport]||FALLBACK.soccer,h='';
  data.forEach(function(d){
    var o1=(1.5+Math.random()*2).toFixed(2),od=(2.8+Math.random()*1.5).toFixed(2),o2=(1.4+Math.random()*2.2).toFixed(2);
    h+='<div class="ev"><div class="evh"><span class="fttag">FT</span><span>Demo data</span></div>';
    h+='<div class="evt"><div class="etm">'+d[0]+'</div><div class="esc">'+d[2]+'</div><div class="etm">'+d[1]+'</div></div>';
    h+='<div class="evos"><div class="ob" onclick="addSlip(\''+d[0]+'\','+o1+')"><div class="ol">Home</div><div class="ov">'+o1+'</div></div>';
    h+='<div class="ob" onclick="addSlip(\'Draw\','+od+')"><div class="ol">Draw</div><div class="ov">'+od+'</div></div>';
    h+='<div class="ob" onclick="addSlip(\''+d[1]+'\','+o2+')"><div class="ol">Away</div><div class="ov">'+o2+'</div></div></div></div>';
  });
  evl.innerHTML=h;
}

// ─── BET SLIP ─────────────────────────────────────────────────────────────────
function addSlip(team,odds){
  slip.push({team:team,odds:odds});renderSlip();
  toast('Added: '+team+' @ '+odds,'ok');
}
function renderSlip(){
  var cnt=document.getElementById('scnt');if(cnt)cnt.textContent=slip.length;
  var em=document.getElementById('slem'),its=document.getElementById('slitems'),ft=document.getElementById('slft');
  if(slip.length===0){if(em)em.style.display='flex';if(its)its.style.display='none';if(ft)ft.style.display='none';return;}
  if(em)em.style.display='none';if(its){its.style.display='block';its.innerHTML=slip.map(function(b,i){return '<div class="slit"><button class="slrm" onclick="rmSlip('+i+')">✕</button><div class="slm">Match</div><div class="slsel">'+b.team+'</div><div class="slod">'+b.odds+'×</div></div>';}).join('');}
  if(ft)ft.style.display='block';uslip();
}
function rmSlip(i){slip.splice(i,1);renderSlip();}
function uslip(){
  var stk=parseInt((document.getElementById('slstk')||{}).value)||10000;
  var tot=slip.reduce(function(a,b){return a*b.odds;},1);
  var pay=Math.floor(stk*tot);
  var sp=document.getElementById('slpay');if(sp)sp.textContent='₿ '+(pay/1e8).toFixed(5);
}
function sss(v){var el=document.getElementById('slstk');if(el){el.value=v;uslip();}}
function placeBet(){
  var stk=parseInt((document.getElementById('slstk')||{}).value)||10000;
  if(!chk(stk))return;
  var tot=slip.reduce(function(a,b){return a*b.odds;},1);
  var won=Math.random()<0.42;
  if(won){var pay=Math.floor(stk*tot);BAL+=pay-stk;updBal();showWin(pay,'Sports Bet');toast('🏆 Bet won! +'+pay.toLocaleString()+' sat','ok');}
  else{BAL-=stk;updBal();toast('❌ Bet lost — -'+stk.toLocaleString()+' sat','er');}
  slip=[];renderSlip();
}

// ─── DEPOSIT ──────────────────────────────────────────────────────────────────
function odep(){document.getElementById('depm').classList.add('on');}
function cdep(){document.getElementById('depm').classList.remove('on');}
function sd(el,amt){depAmt=amt;document.querySelectorAll('.da').forEach(function(d){d.classList.remove('on');});el.classList.add('on');}
function cfdep(){BAL+=depAmt;updBal();cdep();toast('✅ Added '+depAmt.toLocaleString()+' sat to balance','ok');}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Wipe hidden static panels so their IDs don't block overlay getElementById calls
(function(){var gpw=document.querySelector('.gpw');if(gpw)gpw.innerHTML='';})();
updBal();
