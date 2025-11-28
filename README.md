# Pelican Bingo

A family event bingo game where players get unique cards based on relatives and their catchphrases.

## How It Works

1. **Configure Relatives**: Add family members and their signature catchphrases
2. **Create an Event**: Set up an event ID (e.g., "thanksgiving2024")
3. **Share via QR**: Generate a QR code so others can join with the same config
4. **Play**: Each player gets a unique bingo card seeded by their name
5. **Win**: Complete a row, column, or diagonal and claim your bingo

## Modes

### Player Mode
- Configure relatives and catchphrases
- Join events via QR code
- Play bingo with your personalized card
- Claim wins with a QR code the host can scan

### Host Mode
- Set the active event ID
- Scan winner QR codes to record victories
- View the winners list for the event

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Output goes to dist/
```

## Deployment

The app is fully static and can be hosted on GitHub Pages or any static file server. No backend required - all data is stored in localStorage.
