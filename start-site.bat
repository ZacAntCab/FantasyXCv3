@echo off
cd /d "%~dp0"
echo.
echo JL Mann Patriots Fantasy XC website is starting...
echo Open http://localhost:8000 in your browser.
echo Close this window to stop the website.
echo.
python -m http.server 8000
pause
