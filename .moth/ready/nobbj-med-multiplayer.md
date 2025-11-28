Introduce a "Host Mode" and "Player Mode":

- At the top of the app, add a simple toggle:
    [Host Mode] [Player Mode]
  Default to Player Mode.

A) Player Mode:
- Behavior is mostly as it is now.
- When a player achieves bingo and taps the "Bingo!" button:
  - Show a full-screen "You win" view.
  - Generate and display a "Winner QR" that encodes:

    {
      "schema": 1,
      "type": "winner",
      "eventId": "<eventId>",
      "playerName": "<playerName>",
      "timestamp": <unix seconds or ms>
    }

  - The QR should encode this as a compact JSON string or using the same
    compression scheme as the join QR.

B) Host Mode:
- In Host Mode, show:
  - Active event info (eventId, name).
  - A "Scan Winner QR" button.
  - A list of winners so far (stored in localStorage under a 
    key like "relativeBingo.winners.<eventId>").

- When "Scan Winner QR" is clicked:
  - Use getUserMedia to access the camera and a local JS QR decoding library.
  - When a QR is successfully decoded:
    - Parse the JSON payload.
    - Validate:
        - payload.type == "winner"
        - payload.eventId matches the current eventId
    - Append the winner to the winner list:
        {
          playerName,
          timestamp
        }
    - Redisplay the winner list (most recent first).
    - Show a brief visual notification:
        "🎉 BINGO! <playerName>"

Implementation constraints:
- All code must remain fully static and hostable on GitHub Pages.
- You may add small JS libraries (QR encode/decode, compression) as local 
  files referenced from index.html.
- Do not add any network-dependent features (no external CDNs, no backends).

Please:
1. Briefly summarize your plan.
2. Then provide updated full contents for:
   - index.html (if modified)
   - pelican.js
   - any new JS files for QR generation/decoding or compression
   - styles.css (only if needed to support new UI).
