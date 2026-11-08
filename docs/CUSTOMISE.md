# Customise your booth

**The fastest way:** tell Claude what you want, in your own words. "Make the buttons gold." "Change 'Strike a pose' to 'Work it!'" "Use my logo." Claude edits the right file and checks it.

**The DIY way:** everything below lives in one file, `public/booth.config.json`. Change a value, save, refresh the page. Run `npm run check` if something looks off: it tells you, in plain English, what's broken.

A few rules for that file: keep the "quote marks", keep the commas between lines, and colours are hex codes like `#ff4fa3` (search "colour picker" in Google to find yours).

## 1. Your event

```json
"event": {
  "name": "Your Event",
  "line2": "06.12.2026 · #yourevent",
  "logo": "brand/logo.png"
}
```

- **name** goes at the top of every photo, and on the start screen.
- **line2** goes next to your logo on every photo. The date and a hashtag work well, or your website or Instagram handle.
- **logo**: put your logo file in `public/brand/` and name it `logo.png`. A PNG with a see-through background looks best. No logo? Make it `""` and line 2 shows bigger instead.

## 2. Colours and fonts

```json
"look": {
  "colours": {
    "background": "#170b1f",
    "text": "#ffffff",
    "muted": "#bfaecb",
    "accent": "#ff4fa3",
    "button": "#ff4fa3",
    "buttonText": "#ffffff"
  },
  "fonts": { "headings": "Shrikhand", "body": "DM Sans" },
  "startScreenImage": "frames/disco/background.jpg"
}
```

These are the booth's screens (the frames have their own colours, see below).
- **background / text**: the screen colour and the main writing colour
- **muted**: the smaller, quieter writing
- **accent**: the glow and highlights
- **button / buttonText**: the big buttons
- **fonts**: any two fonts from fonts.google.com, typed exactly as Google spells them. A fun one for headings, an easy-to-read one for everything else. The event name on the photos uses the headings font.
- **startScreenImage**: art behind the start screen. Any of your frame backgrounds works. `""` = plain.

## 3. The words on screen

Every word guests see is in the `"words"` section, so you can make it sound like you. `{n}` is filled in with the photo number. Keep it short: guests read it from a step back.

## 4. The booth itself

```json
"booth": {
  "camera": "back",
  "firstCountdown": 5,
  "nextCountdown": 3,
  "askForEmail": "optional",
  "optInText": "Keep me posted about future events (optional)",
  "privacyNote": "Photos taken here may show on the big screen during the event."
}
```

- **camera**: `"back"` takes better photos, but guests can't see the screen unless someone runs the booth. `"front"` is the selfie camera: guests see themselves, like a mirror. You can also switch on the day by adding `?cam=front` to the booth link (before the `#`).
- **firstCountdown / nextCountdown**: seconds before the first photo, then between photos.
- **askForEmail** (only matters once email sending is on): `"optional"` shows a "skip" button, `"required"` doesn't, `"off"` never asks.
- **optInText**: the "keep me posted" tick box. It always starts unticked.
- **privacyNote**: the small line on the start screen.

## 5. The email, the guest page, the wall, the slideshow

- **email**: the subject line and the words in the email guests get.
- **guestPage**: the words on the page their QR code opens, including your "tag us" line.
- **wall.show**: `"raw"` shows each photo on its own (more variety on the big screen), `"framed"` shows the finished framed post.
- **slideshow**: the title, the line under it, and how many seconds each photo stays up.

## 6. Your frames

Each frame is a folder in `public/frames/`, with its art and a small `frame.json`. The `"frames"` list in the config sets which ones guests can pick, in order. Take a name out of the list to hide that frame without deleting it. One frame only? The booth skips the "pick your frame" step.

```json
{
  "label": "Garden party",
  "accent": "#d9798f",
  "background": "background.jpg",
  "backgroundColour": "#f7ecdc",
  "photos": { "border": "print", "colour": "#ffffff", "tilt": false },
  "title": { "colour": "#7a3e4a", "plate": "#fbf3e8d9" },
  "card": { "colour": "#ffffffd9", "textColour": "#7a3e4a" }
}
```

- **label**: the name guests see when they pick a frame
- **accent**: the glow around the camera when this frame is picked
- **background**: the art file in this frame's folder (`""` = just the background colour)
- **backgroundColour**: shows behind the art, or on its own if there's no art
- **photos.border**: `print` (white edge), `polaroid` (thick bottom edge), `thin`, `rounded` (soft corners, no edge) or `none`
- **photos.colour**: the border colour. **photos.tilt**: `true` gives a scrapbook tilt
- **title.colour**: the event name colour. **title.plate**: a colour behind the event name, so it reads on busy art. `""` = none
- **card**: the 4th square on the feed post, where your logo and line 2 go

Colours with 8 digits are see-through: the last two digits set how solid. `cc` is about 80%, `99` about 60%, `66` about 40%.

To see your changes without a camera, open the **frame preview** (`/preview`) and refresh it.

Want a new frame? See [Make frames with Codex](FRAMES-WITH-CODEX.md).
