// JL MANN PATRIOTS FANTASY XC
const SHEET_ID = "1HFZtSJ_JsVPoTKThUnztagSREVcrlD-UfzBIbWTvT_Q";
const SHEET_TABS = ["Players","Teams","Meets","Results"];
let DATA = {Players:[], Teams:[], Meets:[], Results:[]};

async function fetchSheet(tab){
  const url=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&tq=${encodeURIComponent("select *")}`;
  const response=await fetch(url+"&v="+Date.now());
  if(!response.ok) throw new Error(`Could not load ${tab} from Google Sheets.`);
  return csvToObjects(await response.text());
}
function csvToObjects(text){
  const rows=parseCSV(text.trim()); if(!rows.length)return [];
  const headers=rows[0].map(x=>String(x).trim());
  return rows.slice(1).filter(row=>row.some(x=>String(x).trim()!=="")).map(row=>{
    const o={}; headers.forEach((h,i)=>o[h]=row[i]??""); return o;
  });
}
function parseCSV(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c==='"'&&quoted&&n==='"'){cell+='"';i++;continue}
    if(c==='"'){quoted=!quoted;continue}
    if(c===','&&!quoted){row.push(cell);cell="";continue}
    if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);cell="";if(row.length)rows.push(row);row=[];continue}
    cell+=c;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)} return rows;
}
function firstValue(o,keys){for(const k of keys)if(o&&o[k]!==undefined&&String(o[k]).trim()!=="")return o[k];return ""}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function playerId(p){return firstValue(p,["Player ID","ID"])}
function playerLink(p){return `<a class="player-link" href="players.html?player=${encodeURIComponent(playerId(p))}">${esc(p.Name)}</a>`}
function resultPlayerId(r){return firstValue(r,["Player ID","ID"])}
function resultMeetId(r){return firstValue(r,["Meet ID"])}
function resultTeam(r,p){return firstValue(r,["Team","Fantasy Team"])||firstValue(p,["Team","Fantasy Team"])}
function resultStatus(r){
  const s=String(firstValue(r,["Status","Result","Finish Status"])).trim().toUpperCase();
  const time=String(firstValue(r,["Time"])).trim().toUpperCase();
  if(s==="DNS"||time==="DNS")return "DNS";
  if(s==="DNF"||time==="DNF")return "DNF";
  return "";
}
function isDNS(r){return resultStatus(r)==="DNS"}
function isDNF(r){return resultStatus(r)==="DNF"}
function raceTimeSeconds(v){
  const s=String(v||"").trim();
  if(!s||/^(DNS|DNF)$/i.test(s))return null;
  const p=s.split(":").map(Number);
  if(p.some(x=>!Number.isFinite(x)))return null;
  if(p.length===3)return p[0]*3600+p[1]*60+p[2];
  if(p.length===2)return p[0]*60+p[1];
  return null;
}
function formatTimeSeconds(n){
  return Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`:"—";
}
function meetResults(id){return DATA.Results.filter(r=>resultMeetId(r)===id)}
function racePlaces(meetId){
  const rows=meetResults(meetId);
  const finished=rows.filter(r=>!isDNS(r)&&!isDNF(r)&&raceTimeSeconds(firstValue(r,["Time"]))!==null)
    .map(r=>({...r,_time:raceTimeSeconds(firstValue(r,["Time"]))}))
    .sort((a,b)=>a._time-b._time);
  const places=new Map();
  // Competition ranking: equal times receive the same place; the next place skips accordingly.
  finished.forEach((r,i)=>{
    const place=i>0&&r._time===finished[i-1]._time ? places.get(resultPlayerId(finished[i-1])) : i+1;
    places.set(resultPlayerId(r),place);
  });
  return places;
}
function racePlace(r,meetId){
  if(isDNS(r)||isDNF(r))return null;
  return racePlaces(meetId).get(resultPlayerId(r))??null;
}
function seasonBest(p){
  const t=DATA.Results.filter(r=>resultPlayerId(r)===playerId(p))
    .map(r=>raceTimeSeconds(firstValue(r,["Time"]))).filter(Number.isFinite);
  return t.length?formatTimeSeconds(Math.min(...t)):"—";
}
function pointsForPlayer(p){
  const out=[];
  DATA.Results.filter(r=>resultPlayerId(r)===playerId(p)&&!isDNS(r)&&!isDNF(r)).forEach(r=>{
    const place=racePlace(r,resultMeetId(r)); if(Number.isFinite(place))out.push(place);
  });
  return out;
}
function averagePoints(p){
  const x=pointsForPlayer(p);
  return x.length?(x.reduce((a,b)=>a+b,0)/x.length).toFixed(1):"0";
}
function meetName(id){const m=DATA.Meets.find(x=>firstValue(x,["Meet ID"])===id);return m?firstValue(m,["Meet"]):id}
function meetDate(id){const m=DATA.Meets.find(x=>firstValue(x,["Meet ID"])===id);return m?firstValue(m,["Date"]):""}

function getIRReplacement(team,id){
  const teamRows=meetResults(id).filter(r=>{
    const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
    return resultTeam(r,p||{})===team;
  });

  if(teamRows.filter(isDNS).length<3)return null;

  const eligible=meetResults(id)
    .filter(r=>{
      if(isDNS(r)||isDNF(r))return false;
      const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
      if(!p)return false;
      const playerTeam=firstValue(p,["Team","Fantasy Team"]);
      if(String(playerTeam||"").trim()!=="")return false;
      return Number.isFinite(raceTimeSeconds(firstValue(r,["Time"])));
    })
    .map(r=>({...r,_time:raceTimeSeconds(firstValue(r,["Time"])),_isIRReplacement:true}))
    .sort((a,b)=>a._time-b._time);

  return eligible.length?eligible[0]:null;
}

function buildTeamMeet(team,id){
  const rows=meetResults(id).filter(r=>{
    const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
    return resultTeam(r,p||{})===team;
  });

  const finished=rows.filter(r=>!isDNS(r)&&!isDNF(r)&&raceTimeSeconds(firstValue(r,["Time"]))!==null)
    .map(r=>({...r,_racePlace:racePlace(r,id)}))
    .sort((a,b)=>a._racePlace-b._racePlace);

  const dnfs=rows.filter(isDNF);
  const ir=getIRReplacement(team,id);

  if(ir){
    ir._racePlace=racePlace(ir,id);
    finished.push(ir);
    finished.sort((a,b)=>a._racePlace-b._racePlace);
  }

  const ordered=finished.concat(dnfs);
  ordered.forEach((r,i)=>r.teamPlace=i+1);
  const scoring=ordered.slice(0,5), extra=ordered.slice(5), dns=rows.filter(isDNS);

  return {rows,scoring,extra,dns,ir,score:scoring.reduce((s,r)=>s+r.teamPlace,0)};
}

function teamFormula(td){
  const parts=td.scoring.map(r=>r.teamPlace)
    .concat(td.extra.map(r=>`(${r.teamPlace})`))
    .concat(td.dns.map(()=>"(DNS)"));
  return parts.length?parts.join(" + "):"—";
}

function teamRunnerFormula(td){
  const label=r=>{
    const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
    const name=p?esc(p.Name):"Unknown Player";
    return r._isIRReplacement?`${name} (IR Replacement)`:name;
  };

  return td.scoring.map(r=>`${r.teamPlace} ${label(r)}${isDNF(r)?" (DNF)":""}`)
    .concat(td.extra.map(r=>`(${r.teamPlace} ${label(r)}${isDNF(r)?" (DNF)":""})`))
    .concat(td.dns.map(r=>`(DNS ${label(r)})`)).join(" + ")||"No runners";
}

function meetIsCompleted(m){
  return String(firstValue(m,["Status"])).trim().toLowerCase()==="completed";
}

function teamRankings(){
  const completed=DATA.Meets.filter(meetIsCompleted);

  return DATA.Teams.map(t=>{
    const name=firstValue(t,["Team"]);
    const meetScores=completed.map(m=>{
      const td=buildTeamMeet(name,firstValue(m,["Meet ID"]));
      return {
        meetId:firstValue(m,["Meet ID"]),
        meet:firstValue(m,["Meet"]),
        date:firstValue(m,["Date"]),
        score:td.score,
        scored:td.scoring.length>=5
      };
    }).filter(x=>x.scored);

    // Season Points/Score are calculated entirely from completed meet results.
    // Lower is better, just like cross-country scoring. Nothing is entered on the Teams sheet.
    const seasonPoints=meetScores.reduce((sum,x)=>sum+x.score,0);
    const average=meetScores.length?seasonPoints/meetScores.length:null;

    return {
      name,
      seasonPoints,
      average,
      meets:meetScores.length,
      meetScores
    };
  }).sort((a,b)=>{
    if(a.meets===0&&b.meets!==0)return 1;
    if(b.meets===0&&a.meets!==0)return -1;
    if(a.seasonPoints!==b.seasonPoints)return a.seasonPoints-b.seasonPoints;
    if((a.average??Infinity)!==(b.average??Infinity))return (a.average??Infinity)-(b.average??Infinity);
    return a.name.localeCompare(b.name);
  }).map((t,i)=>({...t,rank:i+1}));
}

async function loadWorkbook(){
  try{for(const tab of SHEET_TABS)DATA[tab]=await fetchSheet(tab);document.dispatchEvent(new Event("xcdataready"))}
  catch(err){console.error(err);document.querySelectorAll("[data-error]").forEach(el=>el.innerHTML=`<strong>Data connection problem:</strong> ${esc(err.message)}<br>Make sure the Google Sheet is published to the web and accessible, and the tabs are named Players, Teams, Meets, and Results.`)}
}
document.addEventListener("xcdataready",()=>{
  const path=location.pathname.split("/").pop();
  if(path==="index.html"||path==="")renderHome();
  if(path==="players.html")renderPlayers();
  if(path==="teams.html")renderTeams();
  if(path==="past-meets.html")renderPastMeets();
  if(path==="meet-calendar.html")renderCalendar();
});
function renderHome(){
  const p=[...DATA.Players].sort((a,b)=>String(firstValue(a,["Season Best"])).localeCompare(String(firstValue(b,["Season Best"]))))[0];
  const upcoming=DATA.Meets.find(m=>String(m.Status).toLowerCase()==="upcoming");
  const completed=[...DATA.Meets].reverse().find(m=>String(m.Status).toLowerCase()==="completed");
  const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};
  set("#player-count",DATA.Players.length);document.querySelector("#leader").innerHTML=p?playerLink(p):"—";
  set("#leader-time",p?seasonBest(p):"—");set("#next-meet",upcoming?firstValue(upcoming,["Meet"]):"—");
  set("#next-date",upcoming?firstValue(upcoming,["Date"]):"—");set("#last-meet",completed?firstValue(completed,["Meet"]):"—");set("#last-date",completed?firstValue(completed,["Date"]):"—");
  const preview=document.querySelector("#preview-players");if(preview)preview.innerHTML=DATA.Players.slice(0,5).map(p=>`<tr><td>${playerLink(p)}</td><td>${esc(firstValue(p,["Team","Fantasy Team"]))}</td><td>${esc(seasonBest(p))}</td><td>${esc(averagePoints(p))}</td></tr>`).join("");
}
function renderPlayers(){
  const q=document.querySelector("#player-search"),table=document.querySelector("#player-rows"),profile=document.querySelector("#profile");
  const selected=new URLSearchParams(location.search).get("player"),p=DATA.Players.find(x=>playerId(x)===selected);
  if(p){
    const results=DATA.Results.filter(r=>resultPlayerId(r)===playerId(p)).sort((a,b)=>String(meetDate(resultMeetId(b))).localeCompare(String(meetDate(resultMeetId(a)))));
    const rows=results.length?results.map(r=>`<tr><td>${esc(meetName(resultMeetId(r)))}</td><td>${esc(meetDate(resultMeetId(r)))}</td><td>${esc(resultTeam(r,p))}</td><td>${esc(firstValue(r,["Time"]))}</td><td>${esc(firstValue(r,["Points","Fantasy Points"]))}</td></tr>`).join(""):`<tr><td colspan="5">No meet results entered yet.</td></tr>`;
    profile.innerHTML=`<div class="profile-heading"><div><h2>${esc(p.Name)}</h2><p>Player Profile</p></div><a class="back-link" href="players.html">← All Players</a></div>
      <div class="grid"><div class="card"><div class="label">Grade</div><div class="value">${esc(firstValue(p,["Grade"]))}</div></div>
      <div class="card"><div class="label">PR</div><div class="value">${esc(firstValue(p,["PR","5K PR"]))}</div></div>
      <div class="card"><div class="label">Season Best</div><div class="value">${esc(seasonBest(p))}</div></div>
      <div class="card"><div class="label">Average Points</div><div class="value">${esc(averagePoints(p))}</div></div></div>
      <div class="panel profile-meets"><h3>Meets Raced</h3><div class="table-wrap"><table><thead><tr><th>Meet</th><th>Date</th><th>Fantasy Team</th><th>Time</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }else profile.innerHTML=`<h2>Select A Player</h2><p>Click a player name below to open their full profile.</p>`;
  function draw(){const term=(q.value||"").toLowerCase().trim();table.innerHTML=DATA.Players.filter(p=>[p.Name,firstValue(p,["Grade"]),firstValue(p,["PR","5K PR"]),firstValue(p,["Season Best"])].join(" ").toLowerCase().includes(term)).map(p=>`<tr><td>${playerLink(p)}</td><td>${esc(firstValue(p,["Grade"]))}</td><td>${esc(firstValue(p,["PR","5K PR"]))}</td><td>${esc(seasonBest(p))}</td><td>${esc(averagePoints(p))}</td></tr>`).join("")}
  q.addEventListener("input",draw);draw();
}
function renderTeams(){
  const rankingBody=document.querySelector("#team-ranking-rows");
  const detailBody=document.querySelector("#team-rows");
  const rankings=teamRankings();

  if(rankingBody){
    rankingBody.innerHTML=rankings.map(t=>{
      const avg=t.average===null?"—":t.average.toFixed(1);
      return `<tr><td><strong>${t.rank}</strong></td><td><strong>${esc(t.name)}</strong></td><td>${t.meets?t.seasonPoints:"—"}</td><td>${avg}</td><td>${t.meets}</td></tr>`;
    }).join("")||`<tr><td colspan="5">No teams found.</td></tr>`;
  }

  if(detailBody){
    detailBody.innerHTML=DATA.Teams.map(t=>{
      const name=firstValue(t,["Team"]),m1=firstValue(t,["Manager 1","Manager"]),m2=firstValue(t,["Manager 2"]);
      const ranking=rankings.find(x=>x.name===name);
      const roster=DATA.Players.filter(p=>firstValue(p,["Team","Fantasy Team"])===name).map(playerLink).join(", ")||"No players listed";
      const meetHistory=ranking&&ranking.meetScores.length
        ? ranking.meetScores.map(x=>`${esc(x.meet)}: <strong>${x.score}</strong>`).join(" · ")
        : "No completed meet scores yet";
      return `<tr><td><strong>${esc(name)}</strong></td><td>${esc(m1)}</td><td>${esc(m2)}</td><td>${ranking?ranking.rank:"—"}</td><td>${ranking&&ranking.meets?ranking.seasonPoints:"—"}</td><td>${ranking&&ranking.average!==null?ranking.average.toFixed(1):"—"}</td><td>${roster}<div class="team-history">${meetHistory}</div></td></tr>`;
    }).join("");
  }
}

function renderPastMeets(){
  const completed=DATA.Meets.filter(m=>String(m.Status).toLowerCase()==="completed");
  const container=document.querySelector("#past-rows");
  container.innerHTML=completed.map(m=>{
    const mid=firstValue(m,["Meet ID"]),results=meetResults(mid);
    const top=results.filter(r=>!isDNS(r)&&!isDNF(r)&&racePlace(r,mid)!==null)
      .sort((a,b)=>racePlace(a,mid)-racePlace(b,mid)).slice(0,10);
    const topHtml=top.length?top.map(r=>{
      const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
      return `<tr><td>${racePlace(r,mid)}</td><td>${p?playerLink(p):"Unknown Player"}</td><td>${esc(firstValue(r,["Time"]))}</td><td>${esc(resultTeam(r,p||{}))}</td></tr>`;
    }).join(""):`<tr><td colspan="4">No finished results entered yet.</td></tr>`;

    const names=[...new Set(
      DATA.Teams.map(t=>firstValue(t,["Team"]))
      .concat(results.map(r=>{
        const p=DATA.Players.find(x=>playerId(x)===resultPlayerId(r));
        return resultTeam(r,p||{});
      }).filter(Boolean))
    )];

    const cards=names.map(team=>{
      const td=buildTeamMeet(team,mid);
      if(!td.rows.length)return "";
      return `<div class="team-score">
        <div class="team-score-head"><strong>${esc(team)}</strong><strong>${td.score||"—"} pts${td.scoring.length<5?" · incomplete":""}</strong></div>
        <div class="formula">${teamFormula(td)}</div>
        <div class="team-runners">${teamRunnerFormula(td)}</div>
      </div>`;
    }).join("");

    return `<section class="panel">
      <h2>${esc(firstValue(m,["Meet"]))}</h2>
      <p>${esc(firstValue(m,["Date"]))} · ${esc(firstValue(m,["Location"]))}</p>
      <h3>Top 10</h3>
      <div class="table-wrap"><table><thead><tr><th>Place</th><th>Player</th><th>Time</th><th>Fantasy Team</th></tr></thead><tbody>${topHtml}</tbody></table></div>
      <h3>Team Scores</h3>
      <div class="team-scores">${cards}</div>
    </section>`;
  }).join("")||`<section class="panel">No completed meets in the spreadsheet yet.</section>`;
}
function renderCalendar(){document.querySelector("#calendar-rows").innerHTML=DATA.Meets.map(m=>`<tr><td>${esc(firstValue(m,["Date"]))}</td><td>${esc(firstValue(m,["Meet"]))}</td><td><span class="badge">${esc(firstValue(m,["Status"]))}</span></td><td>${esc(firstValue(m,["Location"]))}</td></tr>`).join("")}
loadWorkbook();
