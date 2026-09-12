JL MANN PATRIOTS FANTASY XC — LIVE SPREADSHEET WEBSITE

FILES
- JL_Mann_Patriots_Fantasy_XC.xlsx = your data source
- index.html = Home
- past-meets.html = Past Meets
- teams.html = Teams
- players.html = Players
- meet-calendar.html = Meet Calendar
- site.js = reads the spreadsheet and builds the pages
- styles.css = site design
- start-site.bat = easiest way to run the site on Windows

HOW UPDATES WORK
1. Open JL_Mann_Patriots_Fantasy_XC.xlsx.
2. Edit the Players, Teams, Meets, or Results sheets.
3. Save the spreadsheet.
4. Refresh the website.
The HTML pages read the spreadsheet each time they load, so the website does not need to be manually edited for normal data changes.

IMPORTANT
Because browsers restrict JavaScript from reading local Excel files when an HTML file is opened with file://, do NOT double-click index.html.

EASIEST WINDOWS METHOD
Double-click start-site.bat.
Then open the address it displays (normally http://localhost:8000).

ALTERNATIVE
If Python is installed:
1. Open a Command Prompt in this folder.
2. Run: python -m http.server 8000
3. Open: http://localhost:8000

ONLINE HOSTING
This folder can also be uploaded to a normal web host. Keep the Excel file in the same folder as the HTML files. When the spreadsheet is changed on the server, visitors see the updated data after refreshing.

SPREADSHEET COLUMNS
Players: Player ID, Name, Grade, 5K PR, Season Best, Team
Teams: Team, Manager, Points
Meets: Meet ID, Meet, Date, Status, Location
Results: Meet ID, Place, Player ID, Time, Points

The website uses the Player ID to connect results and clickable player profiles, so keep Player IDs unique and unchanged.
