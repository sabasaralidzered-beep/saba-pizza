# Saba's Pizza

Interactive ordering template: lift the lid, build the pizza, watch it bake. Concept only, no real orders and no customer data.

Run locally: `python3 -m http.server 8792` in this folder, then open http://localhost:8792

Adapt for a client:
- `app.js`: `BRAND`, `DOUGHS`, `INGREDIENTS` and `RIDE_STOPS`
- `index.html`: box art in `lidArt`, card copy, footer
- `styles.css`: colours in `:root`

Deploy: any static host (Netlify, Vercel, GitHub Pages). Before using it for a real business, connect a real order channel (WhatsApp or a payment link) and remove the concept line in the footer.

Photos are AI-generated (Higgsfield, nano_banana_2). Originals are in `assets/raw`; only the `.webp` files are needed to deploy.
