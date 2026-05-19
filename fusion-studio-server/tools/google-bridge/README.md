# Google Bridge Setup

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Paste the contents of `google-bridge.gs` into the script editor.
3. Run `setup()` once — it generates a secret key stored in Script Properties.
4. Deploy as Web App:
   - Execute as: Me
   - Access: Anyone
5. Copy the deployment URL and secret key into Fusion Studio → Settings → Secrets Manager:
   - `GOOGLE_BRIDGE_URL`
   - `GOOGLE_BRIDGE_KEY`

The secret key never leaves your machine. The Apps Script deployment only accepts calls presenting that key.
