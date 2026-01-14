# TimeFlow

A beautiful activity dashboard that combines [TimeSink](https://manytricks.com/timesink/) and [Balance](https://balanceapp.com/) exports into visual reports.

## Features

- **Import CSV exports** from TimeSink (app usage) and Balance (manual time tracking)
- **Automatic app categorization** — apps are sorted into categories like Writing, Music Creation, Browsing, Productivity, etc.
- **Focused vs Other work** — Writing and Music Creation apps are marked as focused work
- **Multiple time views**:
  - **Day**: Horizontal timeline showing app usage throughout the day
  - **Week/Month**: Vertical 24-hour timelines for each day (07:00–22:00)
  - **Year**: Aggregated stacked bar chart by month
- **Category filtering** — click any category to filter the view
- **Focus sessions overlay** — see Pomodoro session counts from Balance
- **Customizable categories** — drag & drop apps between categories
- **Local storage** — all data stays in your browser
- **Export options** — JSON backup or CSV summary

## Tech Stack

- Vanilla JavaScript (no frameworks)
- HTML5 Canvas for charts
- CSS3 with Tokyo Night color scheme
- localStorage for persistence

## Privacy

All data processing happens locally in the browser. No data is sent to any server. Your time tracking data never leaves your machine.

## License

MIT
