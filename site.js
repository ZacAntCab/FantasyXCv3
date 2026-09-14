// JL MANN PATRIOTS FANTASY XC

const SHEET_ID = "1HFZtSJ_JsVPoTKThUnztagSREVcrlD-UfzBIbWTvT_Q";
const SHEET_TABS = ["Players", "Teams", "Meets", "Results"];

let DATA = {
  Players: [],
  Teams: [],
  Meets: [],
  Results: []
};


// ==============================
// GOOGLE SHEETS
// ==============================

async function fetchSheet(tab) {
  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}` +
    `/gviz/tq?tqx=out:csv` +
    `&sheet=${encodeURIComponent(tab)}` +
    `&tq=${encodeURIComponent("select *")}`;

  const response = await fetch(url + "&v=" + Date.now());

  if (!response.ok) {
    throw new Error(`Could not load ${tab} from Google Sheets.`);
  }

  return csvToObjects(await response.text());
}


function csvToObjects(text) {
  const rows = parseCSV(text.trim());

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(x => String(x).trim());

  return rows
    .slice(1)
    .filter(row => row.some(x => String(x).trim() !== ""))
    .map(row => {
      const o = {};

      headers.forEach((h, i) => {
        o[h] = row[i] ?? "";
      });

      return o;
    });
}


function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && quoted && n === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && n === "\n") {
        i++;
      }

      row.push(cell);
      cell = "";

      if (row.length) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += c;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}


// ==============================
// GENERAL HELPERS
// ==============================

function firstValue(o, keys) {
  for (const k of keys) {
    if (
      o &&
      o[k] !== undefined &&
      String(o[k]).trim() !== ""
    ) {
      return o[k];
    }
  }

  return "";
}


function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m])
  );
}


// ==============================
// PLAYER HELPERS
// ==============================

function playerId(p) {
  return firstValue(p, ["Player ID", "ID"]);
}


function playerLink(p) {
  return `
    <a
      class="player-link"
      href="players.html?player=${encodeURIComponent(playerId(p))}"
    >
      ${esc(p.Name)}
    </a>
  `;
}


function resultPlayerId(r) {
  return firstValue(r, ["Player ID", "ID"]);
}


function resultMeetId(r) {
  return firstValue(r, ["Meet ID"]);
}


// Player's fantasy team comes from the Results sheet first,
// then falls back to the Players sheet.
function resultTeam(r,p){
  return firstValue(r,["Team","Fantasy Team"]) || "Free Agent";
}


// ==============================
// STATUS / TIME
// ==============================

function resultStatus(r) {
  const s = String(
    firstValue(r, ["Status", "Result", "Finish Status"])
  )
    .trim()
    .toUpperCase();

  const time = String(
    firstValue(r, ["Time"])
  )
    .trim()
    .toUpperCase();

  if (s === "DNS" || time === "DNS") {
    return "DNS";
  }

  if (s === "DNF" || time === "DNF") {
    return "DNF";
  }

  return "";
}


function isDNS(r) {
  return resultStatus(r) === "DNS";
}


function isDNF(r) {
  return resultStatus(r) === "DNF";
}


function raceTimeSeconds(v) {
  const s = String(v || "").trim();

  if (!s || /^(DNS|DNF)$/i.test(s)) {
    return null;
  }

  const p = s.split(":").map(Number);

  if (p.some(x => !Number.isFinite(x))) {
    return null;
  }

  if (p.length === 3) {
    return p[0] * 3600 + p[1] * 60 + p[2];
  }

  if (p.length === 2) {
    return p[0] * 60 + p[1];
  }

  return null;
}


function formatTimeSeconds(n) {
  return Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "—";
}


// ==============================
// MEET / RESULT HELPERS
// ==============================

function meetResults(id) {
  return DATA.Results.filter(
    r => resultMeetId(r) === id
  );
}


function meetName(id) {
  const m = DATA.Meets.find(
    x => firstValue(x, ["Meet ID"]) === id
  );

  return m
    ? firstValue(m, ["Meet"])
    : id;
}


function meetDate(id) {
  const m = DATA.Meets.find(
    x => firstValue(x, ["Meet ID"]) === id
  );

  return m
    ? firstValue(m, ["Date"])
    : "";
}


// ==============================
// AUTOMATIC RACE PLACES
// ==============================

// Places are calculated from Time.
// Place does NOT need to be entered into Google Sheets.
//
// Competition ranking is used:
// 1st
// 2nd
// 2nd
// 4th
//
// Equal times receive the same place.

function racePlaces(meetId) {
  const rows = meetResults(meetId);

  const finished = rows
    .filter(
      r =>
        !isDNS(r) &&
        !isDNF(r) &&
        raceTimeSeconds(firstValue(r, ["Time"])) !== null
    )
    .map(r => ({
      ...r,
      _time: raceTimeSeconds(firstValue(r, ["Time"]))
    }))
    .sort((a, b) => a._time - b._time);

  const places = new Map();

  finished.forEach((r, i) => {
    const place =
      i > 0 &&
      r._time === finished[i - 1]._time
        ? places.get(
            resultPlayerId(finished[i - 1])
          )
        : i + 1;

    places.set(
      resultPlayerId(r),
      place
    );
  });

  return places;
}


function racePlace(r, meetId) {
  if (isDNS(r) || isDNF(r)) {
    return null;
  }

  return (
    racePlaces(meetId).get(
      resultPlayerId(r)
    ) ?? null
  );
}


// ==============================
// SEASON BEST / PLAYER SCORING
// ==============================

function seasonBest(p) {
  const times = DATA.Results
    .filter(
      r =>
        resultPlayerId(r) === playerId(p)
    )
    .map(
      r =>
        raceTimeSeconds(
          firstValue(r, ["Time"])
        )
    )
    .filter(Number.isFinite);

  return times.length
    ? formatTimeSeconds(Math.min(...times))
    : "—";
}


function pointsForPlayer(p) {
  const out = [];

  DATA.Results
    .filter(
      r =>
        resultPlayerId(r) === playerId(p) &&
        !isDNS(r) &&
        !isDNF(r)
    )
    .forEach(r => {
      const place = racePlace(
        r,
        resultMeetId(r)
      );

      if (Number.isFinite(place)) {
        out.push(place);
      }
    });

  return out;
}


function averagePoints(p) {
  const x = pointsForPlayer(p);

  return x.length
    ? (
        x.reduce((a, b) => a + b, 0) /
        x.length
      ).toFixed(1)
    : "0";
}


// ==============================
// IR REPLACEMENT
// ==============================

// A player is IR for a particular meet when
// they have no fantasy team recorded on that
// meet's Results row.
//
// If a fantasy team has 3 or more DNS runners,
// the fastest IR runner who actually raced
// becomes the team's one IR replacement.
//
// IMPORTANT:
// - Finished IR runners are eligible.
// - DNF IR runners are ALSO eligible.
// - DNS IR runners are NOT eligible.
//
// If there is at least one IR finisher,
// the fastest finisher is selected.
// If there are no IR finishers but there is
// an IR DNF, the DNF is selected.

// ==============================
// IR REPLACEMENT
// ==============================

// A player is IR when they are not assigned
// to a fantasy team in the Players sheet.
//
// If a fantasy team has 3 or more DNS runners,
// the fastest eligible IR runner who actually
// raced that meet becomes the team's
// one IR replacement.
//
// Finished IR runners are eligible.
// DNF IR runners are ALSO eligible.
// DNS IR runners are NOT eligible.

function getIRReplacement(team, id) {
  const meetRows = meetResults(id);

  // Count DNS runners assigned to this team
  // for THIS specific meet.
  const teamRows = meetRows.filter(r => {
    const historicalTeam =
      firstValue(r, ["Team"]).trim();

    return historicalTeam === team;
  });

  const dnsCount =
    teamRows.filter(isDNS).length;

  if (dnsCount < 3) {
    return null;
  }

  // IR is determined from the player's current
  // Players-sheet team assignment.
  //
  // A runner must actually have a result in
  // this meet. DNS does not qualify.
  //
  // DNF DOES qualify.
  const eligible = meetRows
    .filter(r => {
      if (isDNS(r)) {
        return false;
      }

      const p = DATA.Players.find(
        x =>
          playerId(x) ===
          resultPlayerId(r)
      );

      if (!p) {
        return false;
      }

      const playerTeam = firstValue(
        p,
        ["Team", "Fantasy Team"]
      );

      // Blank current team = IR.
      if (
        String(playerTeam || "").trim() !== ""
      ) {
        return false;
      }

      // DNF IR runners are allowed.
      if (isDNF(r)) {
        return true;
      }

      // Normal finished IR runner must have
      // a valid race time.
      return Number.isFinite(
        raceTimeSeconds(
          firstValue(r, ["Time"])
        )
      );
    })
    .map(r => ({
      ...r,
      _time: isDNF(r)
        ? Infinity
        : raceTimeSeconds(
            firstValue(r, ["Time"])
          ),
      _isIRReplacement: true
    }))
    .sort(
      (a, b) => a._time - b._time
    );

  return eligible.length
    ? eligible[0]
    : null;
}


// ==============================
// TEAM MEET SCORING
// ==============================

function buildTeamMeet(teamName, meetId) {
  const allResults =
    meetResults(meetId);

  // Get the overall race places for EVERY
  // runner in this meet.
  //
  // IMPORTANT:
  // racePlaces() returns a Map, so use
  // places.get(playerId), NOT places[playerId].
  const places =
    racePlaces(meetId);

  // IMPORTANT:
  // For a historical meet, use the Team
  // recorded on THAT meet's Results row.
  //
  // Do not use the player's current team.
  const teamResults =
    allResults
      .map(r => {
        const p =
          DATA.Players.find(
            x =>
              playerId(x) ===
              resultPlayerId(r)
          );

        const historicalTeam =
          firstValue(
            r,
            ["Team"]
          ).trim();

        return {
          ...r,
          player: p || null,
          team: historicalTeam,
          status: resultStatus(r)
        };
      })
      .filter(
        r =>
          r.player &&
          r.team === teamName
      );

  // Finished runners, ordered by their
  // actual overall race place.
  const finished =
    teamResults
      .filter(
        r =>
          !isDNS(r) &&
          !isDNF(r)
      )
      .map(r => ({
        ...r,
        racePlace:
          places.get(
            resultPlayerId(r)
          ) ?? null
      }))
      .filter(
        r =>
          Number.isFinite(
            r.racePlace
          )
      )
      .sort(
        (a, b) =>
          a.racePlace -
          b.racePlace
      );

  // DNF runners come after all finishers.
  const dnfs =
    teamResults.filter(
      r => isDNF(r)
    );

  // DNS runners do not score.
  const dns =
    teamResults.filter(
      r => isDNS(r)
    );

  const ordered = [
    ...finished,
    ...dnfs
  ];

  // If this team has 3+ DNS runners,
  // get one IR replacement.
  //
  // This can now be a finished IR runner
  // OR a DNF IR runner.
  const ir =
    getIRReplacement(
      teamName,
      meetId
    );

  if (ir) {
    const irPlayer =
      DATA.Players.find(
        p =>
          playerId(p) ===
          resultPlayerId(ir)
      );

    ordered.push({
      ...ir,
      player:
        irPlayer || null,
      team: "",
      status:
        resultStatus(ir),
      racePlace:
        places.get(
          resultPlayerId(ir)
        ) ?? null,
      _isIRReplacement: true
    });
  }

  // First five runners score.
  const scoring =
    ordered.slice(0, 5);

  // Runners 6+ are displacers.
  const extra =
    ordered.slice(5);

  // Team score = actual overall race
  // places of the first five.
  //
  // DNF gets a penalty place after
  // all finishers in the meet.
  const finishedCount =
    places.size;

  const score =
    scoring.reduce(
      (sum, r) => {
        if (
          Number.isFinite(
            r.racePlace
          )
        ) {
          return (
            sum +
            r.racePlace
          );
        }

        if (isDNF(r)) {
          return (
            sum +
            finishedCount +
            1
          );
        }

        return sum;
      },
      0
    );

  return {
    team: teamName,
    score,
    scoring,
    extra,
    displacers: extra,
    dns,
    rows: teamResults
  };
}
// ==============================
// TEAM SCORE DISPLAY
// ==============================

function teamFormula(td) {
  const parts = td.scoring
    .map(r => {
      if (Number.isFinite(r.racePlace)) {
        return String(r.racePlace);
      }

      if (isDNF(r)) {
        return "DNF";
      }

      return "—";
    })
    .concat(
      td.extra.map(r => {
        if (Number.isFinite(r.racePlace)) {
          return `(${r.racePlace})`;
        }

        if (isDNF(r)) {
          return "(DNF)";
        }

        return "(—)";
      })
    )
    .concat(
      td.dns.map(() => "(DNS)")
    );

  return parts.length ? parts.join(" + ") : "—";
}


function teamRunnerFormula(td) {
  const label = r => {
    const p = DATA.Players.find(
      x => playerId(x) === resultPlayerId(r)
    );

    const name = p ? esc(p.Name) : "Unknown Player";

    return r._isIRReplacement
      ? `${name} (IR Replacement)`
      : name;
  };

  return td.scoring
    .map(r => {
      let place = Number.isFinite(r.racePlace)
        ? r.racePlace
        : "DNF";

      return `${place} ${label(r)}${
        isDNF(r) ? " (DNF)" : ""
      }`;
    })
    .concat(
      td.extra.map(r => {
        let place = Number.isFinite(r.racePlace)
          ? r.racePlace
          : "DNF";

        return `(${place} ${label(r)}${
          isDNF(r) ? " (DNF)" : ""
        })`;
      })
    )
    .concat(
      td.dns.map(
        r => `(DNS ${label(r)})`
      )
    )
    .join(" + ") || "No runners";
}
// ==============================
// TEAM RANKINGS
// ==============================

function meetIsCompleted(m) {
  return (
    String(
      firstValue(m, ["Status"])
    )
      .trim()
      .toLowerCase() ===
    "completed"
  );
}


function teamRankings() {
  const completed =
    DATA.Meets.filter(
      meetIsCompleted
    );

  return DATA.Teams
    .map(t => {
      const name =
        firstValue(
          t,
          ["Team"]
        );

      const meetScores =
        completed
          .map(m => {
            const td =
              buildTeamMeet(
                name,
                firstValue(
                  m,
                  ["Meet ID"]
                )
              );

            return {
              meetId:
                firstValue(
                  m,
                  ["Meet ID"]
                ),

              meet:
                firstValue(
                  m,
                  ["Meet"]
                ),

              date:
                firstValue(
                  m,
                  ["Date"]
                ),

              score:
                td.score,

              // A team only receives
              // season points from a
              // meet when it has five
              // scoring runners.
              scored:
                td.scoring.length >= 5
            };
          })
          .filter(
            x => x.scored
          );

      const seasonPoints =
        meetScores.reduce(
          (sum, x) =>
            sum + x.score,
          0
        );

      const average =
        meetScores.length
          ? seasonPoints /
            meetScores.length
          : null;

      return {
        name,
        seasonPoints,
        average,
        meets:
          meetScores.length,
        meetScores
      };
    })
    .sort((a, b) => {
      // Teams with no scored meets
      // go to the bottom.
      if (
        a.meets === 0 &&
        b.meets !== 0
      ) {
        return 1;
      }

      if (
        b.meets === 0 &&
        a.meets !== 0
      ) {
        return -1;
      }

      // Lower season points is better.
      if (
        a.seasonPoints !==
        b.seasonPoints
      ) {
        return (
          a.seasonPoints -
          b.seasonPoints
        );
      }

      // Tie breaker: lower average.
      if (
        (a.average ?? Infinity) !==
        (b.average ?? Infinity)
      ) {
        return (
          (a.average ?? Infinity) -
          (b.average ?? Infinity)
        );
      }

      return a.name.localeCompare(
        b.name
      );
    })
    .map((t, i) => ({
      ...t,
      rank: i + 1
    }));
}


// ==============================
// LOAD DATA
// ==============================

async function loadWorkbook() {
  try {
    for (const tab of SHEET_TABS) {
      DATA[tab] =
        await fetchSheet(tab);
    }

    document.dispatchEvent(
      new Event("xcdataready")
    );
  } catch (err) {
    console.error(err);

    document
      .querySelectorAll(
        "[data-error]"
      )
      .forEach(el => {
        el.innerHTML =
          `<strong>Data connection problem:</strong> ` +
          `${esc(err.message)}` +
          `<br>` +
          `Make sure the Google Sheet is published to the web and accessible, ` +
          `and the tabs are named Players, Teams, Meets, and Results.`;
      });
  }
}


// ==============================
// PAGE ROUTING
// ==============================

document.addEventListener(
  "xcdataready",
  () => {
    const path =
      location.pathname
        .split("/")
        .pop();

    if (
      path === "index.html" ||
      path === ""
    ) {
      renderHome();
    }

    if (
      path === "players.html"
    ) {
      renderPlayers();
    }

    if (
      path === "teams.html"
    ) {
      renderTeams();
    }

    if (
      path === "past-meets.html"
    ) {
      renderPastMeets();
    }

    if (
      path === "meet-calendar.html"
    ) {
      renderCalendar();
    }
  }
);


// ==============================
// HOME PAGE
// ==============================

function renderHome() {
  // Find the player with the fastest
  // calculated season best.
  const playersWithTimes =
    DATA.Players
      .map(p => ({
        player: p,
        time: Math.min(
          ...DATA.Results
            .filter(
              r =>
                resultPlayerId(r) ===
                playerId(p)
            )
            .map(
              r =>
                raceTimeSeconds(
                  firstValue(
                    r,
                    ["Time"]
                  )
                )
            )
            .filter(
              Number.isFinite
            )
        )
      }))
      .filter(
        x =>
          Number.isFinite(
            x.time
          )
      );

  playersWithTimes.sort(
    (a, b) =>
      a.time - b.time
  );

  const p =
    playersWithTimes.length
      ? playersWithTimes[0].player
      : null;

  const upcoming =
    DATA.Meets.find(
      m =>
        String(
          m.Status
        ).toLowerCase() ===
        "upcoming"
    );

  const completed =
    [...DATA.Meets]
      .reverse()
      .find(
        m =>
          String(
            m.Status
          ).toLowerCase() ===
          "completed"
      );

  const set = (id, v) => {
    const e =
      document.querySelector(id);

    if (e) {
      e.textContent = v;
    }
  };

  set(
    "#player-count",
    DATA.Players.length
  );

  const leader =
    document.querySelector(
      "#leader"
    );

  if (leader) {
    leader.innerHTML =
      p
        ? playerLink(p)
        : "—";
  }

  set(
    "#leader-time",
    p
      ? seasonBest(p)
      : "—"
  );

  set(
    "#next-meet",
    upcoming
      ? firstValue(
          upcoming,
          ["Meet"]
        )
      : "—"
  );

  set(
    "#next-date",
    upcoming
      ? firstValue(
          upcoming,
          ["Date"]
        )
      : "—"
  );

  set(
    "#last-meet",
    completed
      ? firstValue(
          completed,
          ["Meet"]
        )
      : "—"
  );

  set(
    "#last-date",
    completed
      ? firstValue(
          completed,
          ["Date"]
        )
      : "—"
  );


  // Homepage player preview.
  const preview =
    document.querySelector(
      "#preview-players"
    );

  if (preview) {
    preview.innerHTML =
      DATA.Players
        .slice(0, 5)
        .map(
          p =>
            `<tr>
              <td>${playerLink(p)}</td>
              <td>${esc(
                firstValue(
                  p,
                  [
                    "Team",
                    "Fantasy Team"
                  ]
                ) ||
                "IR / Unassigned"
              )}</td>
              <td>${esc(
                seasonBest(p)
              )}</td>
              <td>${esc(
                averagePoints(p)
              )}</td>
            </tr>`
        )
        .join("");
  }


  // Homepage team rankings preview.
  const teamPreview =
    document.querySelector(
      "#preview-teams"
    );

  if (teamPreview) {
    const rankings =
      teamRankings();

    teamPreview.innerHTML =
      rankings
        .slice(0, 5)
        .map(
          t =>
            `<tr>
              <td>${t.rank}</td>
              <td>${esc(
                t.name
              )}</td>
              <td>${
                t.meets
                  ? t.seasonPoints
                  : "—"
              }</td>
            </tr>`
        )
        .join("");
  }
}


// ==============================
// PLAYERS PAGE
// ==============================

function renderPlayers() {
  const q =
    document.querySelector(
      "#player-search"
    );

  const table =
    document.querySelector(
      "#player-rows"
    );

  const profile =
    document.querySelector(
      "#profile"
    );

  const selected =
    new URLSearchParams(
      location.search
    ).get("player");

  const p =
    DATA.Players.find(
      x =>
        playerId(x) ===
        selected
    );

  // ============================
  // PLAYER COMPARISON HELPERS
  // ============================

  function meetsRun(p) {
    return DATA.Results.filter(
      r =>
        resultPlayerId(r) === playerId(p) &&
        !isDNS(r)
    ).length;
  }

  function bestFinish(p) {
    const places = pointsForPlayer(p);

    return places.length
      ? Math.min(...places)
      : null;
  }

  function playerMetric(p, sortBy) {
    if (sortBy === "pr") {
      return raceTimeSeconds(
        firstValue(p, ["PR", "5K PR"])
      );
    }

    if (sortBy === "sb") {
      return raceTimeSeconds(
        seasonBest(p)
      );
    }

    if (sortBy === "average") {
      const avg = Number(averagePoints(p));
      return Number.isFinite(avg) ? avg : Infinity;
    }

    if (sortBy === "meets") {
      return meetsRun(p);
    }

    return 0;
  }

  function comparisonResult(p, r) {
    const status = resultStatus(r);

    if (status === "DNS") {
      return "DNS";
    }

    if (status === "DNF") {
      return "DNF";
    }

    const place = racePlace(
      r,
      resultMeetId(r)
    );

    const time =
      firstValue(r, ["Time"]) || "—";

    return Number.isFinite(place)
      ? `${time} · ${place}${ordinalSuffix(place)}`
      : time;
  }

  function comparisonMeetRows(a, b) {
    const ids = [
      ...new Set(
        DATA.Results
          .filter(
            r =>
              resultPlayerId(r) === playerId(a) ||
              resultPlayerId(r) === playerId(b)
          )
          .map(resultMeetId)
      )
    ];

    ids.sort(
      (x, y) =>
        String(meetDate(y)).localeCompare(
          String(meetDate(x))
        )
    );

    return ids
      .map(id => {
        const ar = DATA.Results.find(
          r =>
            resultPlayerId(r) === playerId(a) &&
            resultMeetId(r) === id
        );

        const br = DATA.Results.find(
          r =>
            resultPlayerId(r) === playerId(b) &&
            resultMeetId(r) === id
        );

        return `
          <tr>
            <td>${esc(meetName(id))}</td>
            <td>${esc(meetDate(id))}</td>
            <td>${ar ? esc(comparisonResult(a, ar)) : "—"}</td>
            <td>${br ? esc(comparisonResult(b, br)) : "—"}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderComparison(a, b) {
    if (!profile) {
      return;
    }

    const aTeam =
      firstValue(
        a,
        ["Team", "Fantasy Team"]
      ) ||
      "IR / Unassigned";

    const bTeam =
      firstValue(
        b,
        ["Team", "Fantasy Team"]
      ) ||
      "IR / Unassigned";

    const aPr =
      firstValue(
        a,
        ["PR", "5K PR"]
      ) || "—";

    const bPr =
      firstValue(
        b,
        ["PR", "5K PR"]
      ) || "—";

    const aSb = seasonBest(a);
    const bSb = seasonBest(b);

    const aAvg = averagePoints(a);
    const bAvg = averagePoints(b);

    const aMeets = meetsRun(a);
    const bMeets = meetsRun(b);

    const aBest = bestFinish(a);
    const bBest = bestFinish(b);

    profile.innerHTML = `
      <div class="profile-heading">
        <div>
          <h2>Compare Athletes</h2>
          <p>${esc(a.Name)} vs. ${esc(b.Name)}</p>
        </div>

        <button
          type="button"
          class="back-link"
          id="compare-back"
          style="background:none;border:0;cursor:pointer;"
        >
          ← Back To ${esc(a.Name)}
        </button>
      </div>

      <div
        class="grid"
        style="grid-template-columns:repeat(2,minmax(0,1fr));"
      >
        <div class="card">
          <div class="label">Athlete</div>
          <div class="value">${esc(a.Name)}</div>
        </div>

        <div class="card">
          <div class="label">Athlete</div>
          <div class="value">${esc(b.Name)}</div>
        </div>

        <div class="card">
          <div class="label">Fantasy Team</div>
          <div class="value">${esc(aTeam)}</div>
        </div>

        <div class="card">
          <div class="label">Fantasy Team</div>
          <div class="value">${esc(bTeam)}</div>
        </div>

        <div class="card">
          <div class="label">PR</div>
          <div class="value">${esc(aPr)}</div>
        </div>

        <div class="card">
          <div class="label">PR</div>
          <div class="value">${esc(bPr)}</div>
        </div>

        <div class="card">
          <div class="label">Season Best</div>
          <div class="value">${esc(aSb)}</div>
        </div>

        <div class="card">
          <div class="label">Season Best</div>
          <div class="value">${esc(bSb)}</div>
        </div>

        <div class="card">
          <div class="label">Average Points</div>
          <div class="value">${esc(aAvg)}</div>
        </div>

        <div class="card">
          <div class="label">Average Points</div>
          <div class="value">${esc(bAvg)}</div>
        </div>

        <div class="card">
          <div class="label">Meets Run</div>
          <div class="value">${aMeets}</div>
        </div>

        <div class="card">
          <div class="label">Meets Run</div>
          <div class="value">${bMeets}</div>
        </div>

        <div class="card">
          <div class="label">Best Finish</div>
          <div class="value">
            ${
              Number.isFinite(aBest)
                ? `${aBest}${ordinalSuffix(aBest)}`
                : "—"
            }
          </div>
        </div>

        <div class="card">
          <div class="label">Best Finish</div>
          <div class="value">
            ${
              Number.isFinite(bBest)
                ? `${bBest}${ordinalSuffix(bBest)}`
                : "—"
            }
          </div>
        </div>
      </div>

      <div class="panel profile-meets">
        <h3>Meet-By-Meet Comparison</h3>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Meet</th>
                <th>Date</th>
                <th>${esc(a.Name)}</th>
                <th>${esc(b.Name)}</th>
              </tr>
            </thead>

            <tbody>
              ${
                comparisonMeetRows(a, b) ||
                `
                  <tr>
                    <td colspan="4">
                      No meet results entered yet.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    const back =
      document.querySelector(
        "#compare-back"
      );

    if (back) {
      back.addEventListener(
        "click",
        () => renderProfile(a)
      );
    }
  }

  function renderProfile(player) {
    if (!profile) {
      return;
    }

    const results =
      DATA.Results
        .filter(
          r =>
            resultPlayerId(r) ===
            playerId(player)
        )
        .sort(
          (a, b) =>
            String(
              meetDate(
                resultMeetId(b)
              )
            ).localeCompare(
              String(
                meetDate(
                  resultMeetId(a)
                )
              )
            )
        );

    const rows =
      results.length
        ? results
            .map(r => {
              const status =
                resultStatus(r);

              let place =
                racePlace(
                  r,
                  resultMeetId(r)
                );

              let scoreDisplay =
                "—";

              if (status === "DNS") {
                scoreDisplay =
                  "DNS";
              } else if (
                status === "DNF"
              ) {
                scoreDisplay =
                  "DNF";
              } else if (
                Number.isFinite(place)
              ) {
                scoreDisplay =
                  String(place);
              }

              return `
                <tr>
                  <td>${esc(
                    meetName(
                      resultMeetId(r)
                    )
                  )}</td>

                  <td>${esc(
                    meetDate(
                      resultMeetId(r)
                    )
                  )}</td>

                  <td>${esc(
                    resultTeam(r, player) ||
                    "IR / Unassigned"
                  )}</td>

                  <td>${esc(
                    firstValue(
                      r,
                      ["Time"]
                    ) || status
                  )}</td>

                  <td>${esc(
                    scoreDisplay
                  )}</td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="5">
              No meet results entered yet.
            </td>
          </tr>
        `;

    const fantasyTeam =
      firstValue(
        player,
        [
          "Team",
          "Fantasy Team"
        ]
      ) ||
      "IR / Unassigned";

    profile.innerHTML = `
      <div class="profile-heading">
        <div>
          <h2>${esc(
            player.Name
          )}</h2>

          <p>Player Profile</p>
        </div>

        <div
          style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"
        >
          <button
            type="button"
            class="compare-player-button"
            id="compare-player-button"
          >
            Compare
          </button>

          <a
            class="back-link"
            href="players.html"
          >
            ← All Players
          </a>
        </div>
      </div>

      <div
        id="compare-picker"
        class="panel"
        style="display:none;margin-bottom:20px;"
      >
        <h3>Compare ${esc(player.Name)} With</h3>

        <div
          style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"
        >
          <select
            id="compare-player-select"
            style="padding:10px;min-width:240px;"
          >
            <option value="">Select Another Athlete</option>
            ${
              [...DATA.Players]
                .sort(
                  (a, b) =>
                    String(a.Name || "").localeCompare(
                      String(b.Name || "")
                    )
                )
                .filter(
                  x =>
                    playerId(x) !==
                    playerId(player)
                )
                .map(
                  x =>
                    `<option value="${esc(
                      playerId(x)
                    )}">${esc(
                      x.Name
                    )}</option>`
                )
                .join("")
            }
          </select>

          <button
            type="button"
            id="compare-go"
            class="compare-player-button"
          >
            Compare
          </button>
        </div>
      </div>

      <div class="grid">

        <div class="card">
          <div class="label">
            Fantasy Team
          </div>

          <div class="value">
            ${esc(
              fantasyTeam
            )}
          </div>
        </div>

        <div class="card">
          <div class="label">
            Grade
          </div>

          <div class="value">
            ${esc(
              firstValue(
                player,
                ["Grade"]
              )
            )}
          </div>
        </div>

        <div class="card">
          <div class="label">
            PR
          </div>

          <div class="value">
            ${esc(
              firstValue(
                player,
                [
                  "PR",
                  "5K PR"
                ]
              )
            )}
          </div>
        </div>

        <div class="card">
          <div class="label">
            Season Best
          </div>

          <div class="value">
            ${esc(
              seasonBest(player)
            )}
          </div>
        </div>

        <div class="card">
          <div class="label">
            Average Points
          </div>

          <div class="value">
            ${esc(
              averagePoints(player)
            )}
          </div>
        </div>

      </div>

      <div class="panel profile-meets">

        <h3>Meets Raced</h3>

        <div class="table-wrap">

          <table>

            <thead>
              <tr>
                <th>Meet</th>
                <th>Date</th>
                <th>Fantasy Team</th>
                <th>Time</th>
                <th>Place / Score</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>

          </table>

        </div>

      </div>
    `;

    const compareButton =
      document.querySelector(
        "#compare-player-button"
      );

    const comparePicker =
      document.querySelector(
        "#compare-picker"
      );

    const compareSelect =
      document.querySelector(
        "#compare-player-select"
      );

    const compareGo =
      document.querySelector(
        "#compare-go"
      );

    if (compareButton && comparePicker) {
      compareButton.addEventListener(
        "click",
        () => {
          comparePicker.style.display =
            comparePicker.style.display === "none"
              ? "block"
              : "none";
        }
      );
    }

    if (compareGo && compareSelect) {
      compareGo.addEventListener(
        "click",
        () => {
          const other =
            DATA.Players.find(
              x =>
                playerId(x) ===
                compareSelect.value
            );

          if (!other) {
            return;
          }

          renderComparison(
            player,
            other
          );
        }
      );
    }
  }

  // ============================
  // INDIVIDUAL PLAYER PROFILE
  // ============================

  if (p) {
    renderProfile(p);
  } else if (profile) {
    profile.innerHTML = `
      <h2>Select A Player</h2>

      <p>
        Click a player name below to open
        their full profile.
      </p>
    `;
  }

  // ============================
  // PLAYER TABLE SORTING
  // ============================

  let sortBy = "name";

  if (
    table &&
    !document.querySelector(
      "#player-sort"
    )
  ) {
    const sortWrap =
      document.createElement("div");

    sortWrap.className =
      "player-sort-controls";

    sortWrap.style.cssText =
      "display:flex;align-items:center;gap:10px;margin:0 0 16px;flex-wrap:wrap;";

    sortWrap.innerHTML = `
      <label
        for="player-sort"
        style="font-weight:600;"
      >
        Sort Runners By
      </label>

      <select
        id="player-sort"
        style="padding:9px 12px;"
      >
        <option value="name">Name</option>
        <option value="pr">PR</option>
        <option value="sb">Season Best</option>
        <option value="average">Average Points</option>
        <option value="meets">Meets Run</option>
      </select>
    `;

    if (table.parentElement) {
      table.parentElement.parentElement
        ? table.parentElement.parentElement.insertBefore(
            sortWrap,
            table.parentElement
          )
        : table.parentElement.insertBefore(
            sortWrap,
            table
          );
    }

    const sortSelect =
      document.querySelector(
        "#player-sort"
      );

    if (sortSelect) {
      sortSelect.addEventListener(
        "change",
        () => {
          sortBy =
            sortSelect.value;

          draw();
        }
      );
    }
  }

  // ============================
  // PLAYER TABLE
  // ============================

  function draw() {
    if (!table) {
      return;
    }

    const term =
      q
        ? (q.value || "")
            .toLowerCase()
            .trim()
        : "";

    const players =
      DATA.Players
        .filter(p => {
          const searchable = [
            p.Name,

            firstValue(
              p,
              [
                "Team",
                "Fantasy Team"
              ]
            ),

            firstValue(
              p,
              ["Grade"]
            ),

            firstValue(
              p,
              [
                "PR",
                "5K PR"
              ]
            ),

            firstValue(
              p,
              ["Season Best"]
            )
          ]
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            term
          );
        });

    players.sort(
      (a, b) => {
        if (sortBy === "name") {
          return String(
            a.Name || ""
          ).localeCompare(
            String(
              b.Name || ""
            )
          );
        }

        if (sortBy === "meets") {
          return (
            playerMetric(b, sortBy) -
            playerMetric(a, sortBy)
          );
        }

        const av =
          playerMetric(
            a,
            sortBy
          );

        const bv =
          playerMetric(
            b,
            sortBy
          );

        if (
          av === Infinity &&
          bv !== Infinity
        ) {
          return 1;
        }

        if (
          bv === Infinity &&
          av !== Infinity
        ) {
          return -1;
        }

        if (av !== bv) {
          return av - bv;
        }

        return String(
          a.Name || ""
        ).localeCompare(
          String(
            b.Name || ""
          )
        );
      }
    );

    table.innerHTML =
      players
        .map(p => {
          const fantasyTeam =
            firstValue(
              p,
              [
                "Team",
                "Fantasy Team"
              ]
            ) ||
            "IR / Unassigned";

          return `
            <tr>

              <td>
                ${playerLink(p)}
              </td>

              <td>
                ${esc(
                  fantasyTeam
                )}
              </td>

              <td>
                ${esc(
                  firstValue(
                    p,
                    ["Grade"]
                  )
                )}
              </td>

              <td>
                ${esc(
                  firstValue(
                    p,
                    [
                      "PR",
                      "5K PR"
                    ]
                  )
                )}
              </td>

              <td>
                ${esc(
                  seasonBest(p)
                )}
              </td>

              <td>
                ${esc(
                  averagePoints(p)
                )}
              </td>

            </tr>
          `;
        })
        .join("");
  }

  if (q) {
    q.addEventListener(
      "input",
      draw
    );
  }

  draw();
}

// ==============================
// TEAMS PAGE
// ==============================

function renderTeams() {
  const rankingBody =
    document.querySelector(
      "#team-ranking-rows"
    ) ||
    document.querySelector(
      "#ranking-rows"
    );

  const detailBody =
    document.querySelector(
      "#team-rows"
    ) ||
    document.querySelector(
      "#teams-rows"
    );

  const rankings =
    teamRankings();


  // ============================
  // TEAM RANKINGS
  // ============================

  if (rankingBody) {
    rankingBody.innerHTML =
      rankings
        .map(t => {
          const avg =
            t.average === null
              ? "—"
              : t.average.toFixed(
                  1
                );

          return `
            <tr>

              <td>
                <strong>
                  ${t.rank}
                </strong>
              </td>

              <td>
                <strong>
                  ${esc(
                    t.name
                  )}
                </strong>
              </td>

              <td>
                ${
                  t.meets
                    ? t.seasonPoints
                    : "—"
                }
              </td>

              <td>
                ${avg}
              </td>

              <td>
                ${t.meets}
              </td>

            </tr>
          `;
        })
        .join("") ||
      `
        <tr>
          <td colspan="5">
            No teams found.
          </td>
        </tr>
      `;
  }


  // ============================
  // TEAM DETAILS
  // ============================

  if (detailBody) {
    detailBody.innerHTML =
      DATA.Teams
        .map(t => {
          const name =
            firstValue(
              t,
              ["Team"]
            );

          const m1 =
            firstValue(
              t,
              [
                "Manager 1",
                "Manager"
              ]
            );

          const m2 =
            firstValue(
              t,
              ["Manager 2"]
            );

          const ranking =
            rankings.find(
              x =>
                x.name === name
            );

          const roster =
            DATA.Players
              .filter(
                p =>
                  firstValue(
                    p,
                    [
                      "Team",
                      "Fantasy Team"
                    ]
                  ) === name
              )
              .map(playerLink)
              .join(", ") ||
            "No players listed";


          const meetHistory =
            ranking &&
            ranking.meetScores.length
              ? ranking.meetScores
                  .map(
                    x =>
                      `${esc(
                        x.meet
                      )}: <strong>${
                        x.score
                      }</strong>`
                  )
                  .join(" · ")
              : "No completed meet scores yet";


          return `
            <tr>

              <td>
                <strong>
                  ${esc(name)}
                </strong>
              </td>

              <td>
                ${esc(m1)}
              </td>

              <td>
                ${esc(m2)}
              </td>

              <td>
                ${
                  ranking
                    ? ranking.rank
                    : "—"
                }
              </td>

              <td>
                ${
                  ranking &&
                  ranking.meets
                    ? ranking.seasonPoints
                    : "—"
                }
              </td>

              <td>
                ${
                  ranking &&
                  ranking.average !== null
                    ? ranking.average.toFixed(
                        1
                      )
                    : "—"
                }
              </td>

              <td>
                ${roster}

                <div class="team-history">
                  ${meetHistory}
                </div>
              </td>

            </tr>
          `;
        })
        .join("");
  }
}


// ==============================
// PAST MEETS PAGE
// ==============================

function renderPastMeets() {
  const completed =
    DATA.Meets.filter(
      m =>
        String(
          m.Status
        ).toLowerCase() ===
        "completed"
    );

  const container =
    document.querySelector(
      "#past-rows"
    ) ||
    document.querySelector(
      "#past-meet-rows"
    ) ||
    document.querySelector(
      "#meet-rows"
    );

  if (!container) {
    return;
  }

  container.innerHTML =
    completed
      .map(m => {
        const mid =
          firstValue(
            m,
            ["Meet ID"]
          );

        const results =
          meetResults(mid);


        // ========================
        // TOP 10
        // ========================

        const top =
          results
            .filter(
              r =>
                !isDNS(r) &&
                !isDNF(r) &&
                racePlace(
                  r,
                  mid
                ) !== null
            )
            .sort(
              (a, b) =>
                racePlace(
                  a,
                  mid
                ) -
                racePlace(
                  b,
                  mid
                )
            )
            .slice(0, 10);


        const topHtml =
          top.length
            ? top
                .map(r => {
                  const p =
                    DATA.Players.find(
                      x =>
                        playerId(x) ===
                        resultPlayerId(r)
                    );

                  return `
                    <tr>

                      <td>
                        ${racePlace(
                          r,
                          mid
                        )}
                      </td>

                      <td>
                        ${
                          p
                            ? playerLink(p)
                            : "Unknown Player"
                        }
                      </td>

                      <td>
                        ${esc(
                          firstValue(
                            r,
                            ["Time"]
                          )
                        )}
                      </td>

                      <td>
                        ${esc(
                          resultTeam(
                            r,
                            p || {}
                          )
                        )}
                      </td>

                    </tr>
                  `;
                })
                .join("")
            : `
              <tr>
                <td colspan="4">
                  No finished results entered yet.
                </td>
              </tr>
            `;


        // ========================
        // TEAM LIST
        // ========================

        const names = [
          ...new Set(
            DATA.Teams
              .map(
                t =>
                  firstValue(
                    t,
                    ["Team"]
                  )
              )
              .concat(
                results
                  .map(r => {
                    const p =
                      DATA.Players.find(
                        x =>
                          playerId(x) ===
                          resultPlayerId(r)
                      );

                    return resultTeam(
                      r,
                      p || {}
                    );
                  })
                  .filter(Boolean)
              )
          )
        ];


        // ========================
        // TEAM SCORE CARDS
        // ========================

        const cards =
          names
            .map(team => {
              const td =
                buildTeamMeet(
                  team,
                  mid
                );

              if (
                !td.rows.length
              ) {
                return "";
              }


              return `
                <div class="team-score">

                  <div class="team-score-head">

                    <strong>
                      ${esc(team)}
                    </strong>

                    <strong>
                      ${
                        td.score ||
                        "—"
                      }
                      pts

                      ${
                        td.scoring
                          .length < 5
                          ? " · incomplete"
                          : ""
                      }
                    </strong>

                  </div>


                  <div class="formula">
                    ${teamFormula(td)}
                  </div>


                  <div class="team-runners">
                    ${teamRunnerFormula(td)}
                  </div>

                </div>
              `;
            })
            .join("");


        return `
          <section class="panel">

            <h2>
              ${esc(
                firstValue(
                  m,
                  ["Meet"]
                )
              )}
            </h2>

            <p>
              ${esc(
                firstValue(
                  m,
                  ["Date"]
                )
              )}
              ·
              ${esc(
                firstValue(
                  m,
                  ["Location"]
                )
              )}
            </p>


            <h3>
              Top 10
            </h3>


            <div class="table-wrap">

              <table>

                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Player</th>
                    <th>Time</th>
                    <th>Fantasy Team</th>
                  </tr>
                </thead>

                <tbody>
                  ${topHtml}
                </tbody>

              </table>

            </div>


            <h3>
              Team Scores
            </h3>


            <div class="team-scores">
              ${cards}
            </div>

          </section>
        `;
      })
      .join("") ||
    `
      <section class="panel">
        No completed meets in the spreadsheet yet.
      </section>
    `;
}


// ==============================
// MEET CALENDAR
// ==============================

function renderCalendar() {
  const body =
    document.querySelector(
      "#calendar-rows"
    );

  if (!body) {
    return;
  }

  body.innerHTML =
    DATA.Meets
      .map(
        m =>
          `
            <tr>

              <td>
                ${esc(
                  firstValue(
                    m,
                    ["Date"]
                  )
                )}
              </td>

              <td>
                ${esc(
                  firstValue(
                    m,
                    ["Meet"]
                  )
                )}
              </td>

              <td>
                <span class="badge">
                  ${esc(
                    firstValue(
                      m,
                      ["Status"]
                    )
                  )}
                </span>
              </td>

              <td>
                ${esc(
                  firstValue(
                    m,
                    ["Location"]
                  )
                )}
              </td>

            </tr>
          `
      )
      .join("");
}


// ==============================
// START
// ==============================

loadWorkbook();
