Flow:
- On the Event screen, add a "Generate Join QR" button.
- When clicked, build a "share blob" object:

  {
    "schema": 1,
    "gameConfig": { ... },   // current relatives config
    "eventConfig": { ... }   // current event config
  }

- Serialize this to JSON and then compress/encode it.
  Implementation suggestions:
    - Use a small local compression helper such as LZString
      (OK to add a tiny standalone JS file bundled in the repo).
    - Use a URL-safe encoding (e.g., LZString.compressToEncodedURIComponent).

- Construct a URL:
    <current origin + path> + "#pelican=" + ENCODED_BLOB

- Render a QR code for that URL in a modal or a dedicated "Share" area.
  Implementation requirements:
    - Use a lightweight, locally-bundled QR generator library 
      (no external network calls).
    - Add a short text label "Scan this to join this event in Pelican".

- On app startup:
  - If window.location.hash contains "pelican=", parse the value:
      1) Remove "pelican=" prefix
      2) Decode/decompress
      3) JSON.parse into { schema, gameConfig, eventConfig }
  - Overwrite current localStorage config with:
      - CONFIG_KEY = gameConfig
      - EVENT_KEY  = eventConfig
  - Optionally display a small banner: 
      "Loaded event <eventConfig.name> from shared link."
