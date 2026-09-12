# JL Mann Patriots Fantasy XC

## Google Sheet tabs

### Players
Use: `Player ID | Name | Grade | PR | Season Best | Average Points Scored`

Player ID is only an internal connection key and is not displayed on the website.

### Teams
Use: `Team | Manager 1 | Manager 2 | Points`

Each fantasy team supports two managers.

### Meets
Use: `Meet ID | Meet | Date | Status | Location`

### Results
Use: `Meet ID | Player ID | Place | Time | Points | Team`

The Team column records which fantasy team the player ran under at that meet.

## Player profiles

Click a player name to see Grade, PR, Season Best, Average Points, and a complete meet history showing the meet, date, fantasy team, time, and points.

If Average Points Scored is blank on Players, the site calculates it from Results.

## Google Sheets

Publish the spreadsheet to the web and make it accessible to the website. The site reads Players, Teams, Meets, and Results directly from Google Sheets.

## GitHub Pages

Settings -> Pages -> Build and deployment -> Deploy from a branch -> main -> /(root).

Update the league in Google Sheets, then refresh the website.


## Scoring and automatic stats
- Individual score is race place; lower is better.
- Team score is the sum of the top five team places.
- Runners 6+ are displacers in parentheses.
- DNS is shown as `(DNS)` and does not count.
- DNF counts as the team's last-place runner.
- Past Meets shows the top 10 finishers and team scoring details.
- Season Best is calculated automatically from each runner's fastest recorded meet time; it does not need to be entered in the spreadsheet.


## Results entry — no Place required

You do **not** need to enter Place or Points in the Results sheet. Enter the runner's **Time** for each meet (plus Meet ID, Player ID, Team if applicable, and Status when needed). The website sorts finished runners by time and automatically determines their race place. Every scoring and standings calculation uses that calculated place.

- Fastest time = 1st place.
- Next fastest = 2nd, etc.
- Equal times receive the same place.
- DNS does not receive a place.
- DNF has no race time/place and is handled as the last runner on that fantasy team for team scoring.
- Season Best is automatically the runner's fastest recorded time.
