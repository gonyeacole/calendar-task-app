# Calendar

Mobile-first calendar app with four tabs: **Calendar**, **To Do**, **Payments** (recurring) and **Events**.
Dark/light theme follows the system. Data is stored in `localStorage` — no backend, no build step.

Run it: `python3 -m http.server 8000` and open http://localhost:8000 (on a phone, use "Add to Home Screen").

- Calendar dots: pink = event, hollow = open task, green = payment due
- Swipe the grid or use the arrows to change month; tap a day to see its items
- `+` adds an item (type defaults to the current tab); tap any item to edit or delete it
