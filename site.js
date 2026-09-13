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
function resultTeam(r, p) {
  return (
    firstValue(r, ["Team", "Fantasy Team"]) ||
    firstValue(p, ["Team", "Fantasy Team"])
  );
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

// A player is IR when they are not assigned
// to a fantasy team in the Players sheet.
//
// If a fantasy team has 3 or more DNS runners,
// the fastest eligible IR runner who actually
// raced that meet becomes the team's
// one IR replacement.

function getIRReplacement(team, id) {
  const teamRows = meetResults(id).filter(r => {
    const p = DATA.Players.find(
      x =>
        playerId(x) ===
        resultPlayerId(r)
    );

    return (
      resultTeam(r, p || {}) === team
    );
  });

  const dnsCount =
    teamRows.filter(isDNS).length;

  if (dnsCount < 3) {
    return null;
  }

  const eligible = meetResults(id)
    .filter(r => {
      if (isDNS(r) || isDNF(r)) {
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

      // Blank team = IR
      if (
        String(playerTeam || "").trim() !== ""
      ) {
        return false;
      }

      return Number.isFinite(
        raceTimeSeconds(
          firstValue(r, ["Time"])
        )
      );
    })
    .map(r => ({
      ...r,
      _time: raceTimeSeconds(
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
// TEAM SCORING
// ==============================

function buildTeamMeet(teamName, meetId) {
  const allResults = meetResults(meetId);
  const places = racePlaces(meetId);

  // Get every result belonging to this fantasy team.
  const teamResults = allResults
    .map(r => {
      const p = DATA.Players.find(
        x =>
          playerId(x) ===
          resultPlayerId(r)
      );

      return {
        result: r,
        player: p || null,
        team: resultTeam(r, p || {}),
        status: resultStatus(r),
        place: racePlace(r, meetId)
      };
    })
    .filter(
      x =>
        x.team === teamName &&
        x.player
    );

  // Finished runners first, ordered by ACTUAL
  // overall race place.
  const finished = teamResults
    .filter(
      x =>
        x.status !== "DNS" &&
        x.status !== "DNF" &&
        Number.isFinite(x.place)
    )
    .sort(
      (a, b) =>
        a.place - b.place
    );

  // DNF runners come after every finisher.
  const dnfs = teamResults.filter(
    x => x.status === "DNF"
  );

  // DNS runners do not count toward the team.
  const dns = teamResults.filter(
    x => x.status === "DNS"
  );

  const ordered = [
    ...finished,
    ...dnfs
  ];

  // If there are at least 3 DNS runners,
  // attempt one IR replacement.
  const replacement =
    getIRReplacement(
      teamName,
      meetId
    );

  if (replacement) {
    const replacementPlayer =
      DATA.Players.find(
        p =>
          playerId(p) ===
          resultPlayerId(replacement)
      );

    const replacementPlace =
      racePlace(
        replacement,
        meetId
      );

    if (
      replacementPlayer &&
      Number.isFinite(replacementPlace)
    ) {
      ordered.push({
        result: replacement,
        player: replacementPlayer,
        team: teamName,
        status: "",
        place: replacementPlace,
        irReplacement: true
      });
    }
  }

  // First five runners score.
  const scoring =
    ordered.slice(0, 5);

  // Everyone after the first five is
  // a displacer / extra runner.
  const extra =
    ordered.slice(5);

  // IMPORTANT:
  // Score is based on the runners' ACTUAL
  // overall race places, NOT their position
  // within their fantasy team.
  //
  // Example:
  // 3rd + 8th + 14th + 21st + 27th
  // = 73 points
  //
  // It is NOT automatically 1+2+3+4+5 = 15.

  let score = 0;

  scoring.forEach(x => {
    if (Number.isFinite(x.place)) {
      score += x.place;
    } else if (x.status === "DNF") {
      // DNF receives a place after all finishers.
      score += places.size + 1;
    }
  });

  return {
    team: teamName,
    meetId: meetId,

    // All team runners used to build the result.
    rows: teamResults,

    // First five scoring runners.
    scoring: scoring,

    // Runners after the first five.
    extra: extra,

    // Alias used elsewhere on the site.
    displacers: extra,

    // DNS runners do not count.
    dns: dns,

    // Final team score.
    score: score
  };
}


// ==============================
// TEAM SCORE DISPLAY
// ==============================

function teamFormula(td) {
  if (!td || !td.scoring.length) {
    return "—";
  }

  return td.scoring
    .map(x => {
      if (x.status === "DNF") {
        return String(
          x.place || "DNF"
        );
      }

      return String(x.place);
    })
    .join(" + ");
}


function teamRunnerFormula(td) {
  if (!td) {
    return "";
  }

  const scoringHtml =
    td.scoring
      .map(x => {
        const name =
          x.player
            ? playerLink(x.player)
            : "Unknown Player";

        const label =
          x.irReplacement
            ? " <span class=\"badge\">IR Replacement</span>"
            : "";

        const place =
          x.status === "DNF"
            ? "DNF"
            : x.place;

        return `
          <div>
            ${name}
            — ${place}${label}
          </div>
        `;
      })
      .join("");

  const extraHtml =
    td.extra
      .map(x => {
        const name =
          x.player
            ? playerLink(x.player)
            : "Unknown Player";

        const place =
          x.status === "DNF"
            ? "DNF"
            : x.place;

        return `
          <div>
            ${name}
            — ${place}
          </div>
        `;
      })
      .join("");

  const dnsHtml =
    td.dns
      .map(x => {
        const name =
          x.player
            ? playerLink(x.player)
            : "Unknown Player";

        return `
          <div>
            ${name} — DNS
          </div>
        `;
      })
      .join("");

  return `
    ${scoringHtml}

    ${
      extraHtml
        ? `
          <div class="team-history">
            <strong>Displacers:</strong>
            ${extraHtml}
          </div>
        `
        : ""
    }

    ${
      dnsHtml
        ? `
          <div class="team-history">
            <strong>DNS:</strong>
            ${dnsHtml}
          </div>
        `
        : ""
    }
  `;
}


// ==============================
// MEET COMPLETION
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


// ==============================
// TEAM RANKINGS
// ==============================

function teamRankings() {
  const teams = DATA.Teams
    .map(t =>
      firstValue(t, ["Team"])
    )
    .filter(Boolean);

  const completedMeets =
    DATA.Meets.filter(
      meetIsCompleted
    );

  const rankings = teams.map(name => {
    const meetScores = [];

    completedMeets.forEach(m => {
      const meetId =
        firstValue(
          m,
          ["Meet ID"]
        );

      const td =
        buildTeamMeet(
          name,
          meetId
        );

      // A meet only counts as a scored
      // team meet if the team has five
      // scoring runners.
      if (
        td.scoring.length >= 5
      ) {
        meetScores.push({
          meet: firstValue(
            m,
            ["Meet"]
          ),
          meetId: meetId,
          score: td.score
        });
      }
    });

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
      name: name,
      meetScores: meetScores,
      seasonPoints:
        seasonPoints,
      average: average,
      meets:
        meetScores.length,
      rank: null
    };
  });


  // Teams with actual completed
  // scores come first.
  rankings.sort((a, b) => {
    if (
      a.meets === 0 &&
      b.meets > 0
    ) {
      return 1;
    }

    if (
      a.meets > 0 &&
      b.meets === 0
    ) {
      return -1;
    }

    if (
      a.seasonPoints !==
      b.seasonPoints
    ) {
      return (
        a.seasonPoints -
        b.seasonPoints
      );
    }

    if (
      a.average !== null &&
      b.average !== null &&
      a.average !== b.average
    ) {
      return (
        a.average -
        b.average
      );
    }

    return a.name.localeCompare(
      b.name
    );
  });


  rankings.forEach(
    (x, i) => {
      x.rank = i + 1;
    }
  );

  return rankings;
}


// ==============================
// HOMEPAGE
// ==============================

function renderHome() {
  const completed =
    DATA.Meets
      .filter(meetIsCompleted)
      .sort(
        (a, b) =>
          String(
            firstValue(
              b,
              ["Date"]
            )
          ).localeCompare(
            String(
              firstValue(
                a,
                ["Date"]
              )
            )
          )
      );

  const upcoming =
    DATA.Meets
      .filter(
        m =>
          !meetIsCompleted(m)
      )
      .sort(
        (a, b) =>
          String(
            firstValue(
              a,
              ["Date"]
            )
          ).localeCompare(
            String(
              firstValue(
                b,
                ["Date"]
              )
            )
          )
      );

  const set = (
    selector,
    value
  ) => {
    const el =
      document.querySelector(
        selector
      );

    if (el) {
      el.textContent =
        value;
    }
  };


  const p =
    DATA.Players
      .slice()
      .sort(
        (a, b) =>
          (
            raceTimeSeconds(
              seasonBest(a)
            ) ??
            Infinity
          ) -
          (
            raceTimeSeconds(
              seasonBest(b)
            ) ??
            Infinity
          )
      )[0];


  set(
    "#player-count",
    DATA.Players.length
  );

  set(
    "#meet-count",
    DATA.Meets.length
  );

  set(
    "#leader-name",
    p
      ? p.Name
      : "—"
  );

  set(
    "#leader-time",
    p
      ? seasonBest(p)
      : "—"
  );

  set(
    "#next-meet",
    upcoming.length
      ? firstValue(
          upcoming[0],
          ["Meet"]
        )
      : "—"
  );

  set(
    "#next-date",
    upcoming.length
      ? firstValue(
          upcoming[0],
          ["Date"]
        )
      : "—"
  );

  set(
    "#last-meet",
    completed.length
      ? firstValue(
          completed[0],
          ["Meet"]
        )
      : "—"
  );

  set(
    "#last-date",
    completed.length
      ? firstValue(
          completed[0],
          ["Date"]
        )
      : "—"
  );


  // ============================
  // HOMEPAGE PLAYER PREVIEW
  // ============================

  const preview =
    document.querySelector(
      "#preview-players"
    );

  if (preview) {
    preview.innerHTML =
      DATA.Players
        .slice(0, 5)
        .map(p => `
          <tr>
            <td>${playerLink(p)}</td>

            <td>
              ${esc(
                firstValue(
                  p,
                  [
                    "Team",
                    "Fantasy Team"
                  ]
                ) ||
                "IR / Unassigned"
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
        `)
        .join("");
  }


  // ============================
  // HOMEPAGE TEAM PREVIEW
  // ============================

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
        .map(t => `
          <tr>
            <td>${t.rank}</td>

            <td>
              ${esc(t.name)}
            </td>

            <td>
              ${
                t.meets
                  ? t.seasonPoints
                  : "—"
              }
            </td>
          </tr>
        `)
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

  if (!table || !profile) {
    return;
  }

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
  // INDIVIDUAL PLAYER PROFILE
  // ============================

  if (p) {
    const results =
      DATA.Results
        .filter(
          r =>
            resultPlayerId(r) ===
            playerId(p)
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

              const place =
                racePlace(
                  r,
                  resultMeetId(r)
                );

              let scoreDisplay =
                "—";

              if (status === "DNS") {
                scoreDisplay = "DNS";
              } else if (
                status === "DNF"
              ) {
                scoreDisplay = "DNF";
              } else if (
                Number.isFinite(place)
              ) {
                scoreDisplay =
                  String(place);
              }

              return `
                <tr>
                  <td>
                    ${esc(
                      meetName(
                        resultMeetId(r)
                      )
                    )}
                  </td>

                  <td>
                    ${esc(
                      meetDate(
                        resultMeetId(r)
                      )
                    )}
                  </td>

                  <td>
                    ${esc(
                      resultTeam(
                        r,
                        p
                      ) ||
                      "IR / Unassigned"
                    )}
                  </td>

                  <td>
                    ${esc(
                      firstValue(
                        r,
                        ["Time"]
                      ) ||
                      status
                    )}
                  </td>

                  <td>
                    ${esc(
                      scoreDisplay
                    )}
                  </td>
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
        p,
        [
          "Team",
          "Fantasy Team"
        ]
      ) ||
      "IR / Unassigned";


    profile.innerHTML = `
      <div class="profile-heading">
        <div>
          <h2>
            ${esc(p.Name)}
          </h2>

          <p>
            Player Profile
          </p>
        </div>

        <a
          class="back-link"
          href="players.html"
        >
          ← All Players
        </a>
      </div>


      <div class="grid">

        <div class="card">
          <div class="label">
            Fantasy Team
          </div>

          <div class="value">
            ${esc(fantasyTeam)}
          </div>
        </div>


        <div class="card">
          <div class="label">
            Grade
          </div>

          <div class="value">
            ${esc(
              firstValue(
                p,
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
                p,
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
              seasonBest(p)
            )}
          </div>
        </div>


        <div class="card">
          <div class="label">
            Average Points
          </div>

          <div class="value">
            ${esc(
              averagePoints(p)
            )}
          </div>
        </div>

      </div>


      <div class="panel profile-meets">

        <h3>
          Meets Raced
        </h3>

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

  } else {

    profile.innerHTML = `
      <h2>
        Select A Player
      </h2>

      <p>
        Click a player name below to open
        their full profile.
      </p>
    `;

  }


  // ============================
  // PLAYER TABLE
  // ============================

  function draw() {
    const term =
      (q
        ? q.value
        : ""
      )
        .toLowerCase()
        .trim();

    table.innerHTML =
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
        })

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
    );

  const detailBody =
    document.querySelector(
      "#team-rows"
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
              : t.average.toFixed(1);

          return `
            <tr>

              <td>
                <strong>
                  ${t.rank}
                </strong>
              </td>

              <td>
                <strong>
                  ${esc(t.name)}
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
        .join("")
      ||
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
                x.name ===
                name
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
              .join(", ")
              ||
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
                    ? ranking.average.toFixed(1)
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
      meetIsCompleted
    );

  const container =
    document.querySelector(
      "#past-rows"
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
                        td.scoring.length >= 5
                          ? td.score
                          : "—"
                      }
                      pts

                      ${
                        td.scoring.length < 5
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
      .join("")
    ||
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

async function loadWorkbook() {
  try {

    DATA.Players =
      await fetchSheet(
        "Players"
      );

    DATA.Teams =
      await fetchSheet(
        "Teams"
      );

    DATA.Meets =
      await fetchSheet(
        "Meets"
      );

    DATA.Results =
      await fetchSheet(
        "Results"
      );


    renderHome();
    renderPlayers();
    renderTeams();
    renderPastMeets();
    renderCalendar();

  } catch (error) {

    console.error(error);

    const errorElements =
      document.querySelectorAll(
        "[data-error]"
      );

    errorElements.forEach(el => {
      el.textContent =
        "Unable to load Google Sheets data. Check that the spreadsheet is published to the web and accessible.";
    });

  }
}


loadWorkbook();
