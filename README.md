# MymoOde-MPD-client

**Mymoode MPD Client** is an alternative, lightweight, and highly customizable web frontend interface developed to interact with **moOde Audio Player** and **MPD (Music Player Daemon)** on a Raspberry Pi environment. 

Born from a passion for high fidelity and historical design, this project combines modern digital music library management with a nostalgic visual experience, introducing dynamic screensavers that faithfully recreate the aesthetics of vintage radios and great classic Hi-Fi amplifiers.

## 🔧 About this fork

This is a fork of [casamia67/mymoode-MPD-client](https://github.com/casamia67/mymoode-MPD-client) with fixes for **moOde 10.x** and working hardware controls on the Hi-Fi screensavers. Tested on moOde 10.3.7 (Raspberry Pi 5) with CamillaDSP 4.1.3.

### Fixes for moOde 10

* **CamillaDSP ON/OFF no longer breaks audio.** moOde runs CamillaDSP through its ALSA plugin, one instance per stream. The original toggle started the standalone `camilladsp.service`, which takes the DAC and websocket port 1234, so every source (MPD, Spotify, Bluetooth, AirPlay) failed with "device busy". The toggle now does nothing, and the status shows whether CamillaDSP is actually processing audio.
* **Updated moOde paths:** `vol.sh` and `thumb-gen.php` moved from `/var/www/command/` to `/var/www/util/` in moOde 10.
* **No more flashing text:** the pages declare `lang="it"`, so browsers auto-translate them, and every 2-second status refresh re-triggered the translation. The pages are now marked `translate="no"`; choose the language in the app's settings instead.

### Working knobs and buttons

* **BASS / TREBLE knobs** control two CamillaDSP filters named `Bass` (Lowshelf 85 Hz, Q 0.9) and `Treble` (Highshelf 6500 Hz, Q 0.7), CamillaGUI's recommended Equalizer setup, over ±12 dB. Drag up/down or scroll to turn, and double-click to reset. `tone.py` adds the filters to the active config at 0 dB, saves knob changes to the config file (so they survive the per-stream CamillaDSP restarts), and updates the running instance live. CamillaGUI's own Bass/Treble shortcuts control the same filters.
* **VOLUME knob** uses the client's normal volume control and follows volume changes made elsewhere.
* **Knob drags no longer change the VU skin:** the screensaver's swipe gesture ignores drags that start on a knob.
* **Play / pause, previous, next, repeat and shuffle follow the active player.** `transport.py` checks which renderer is feeding the DAC (CamillaDSP's parent process), falling back to moOde's `btactive` / `spotactive` / `aplactive` flags:
  * **MPD:** unchanged.
  * **Bluetooth:** sent to the phone over AVRCP (BlueZ `MediaPlayer1`), if the device supports it.
  * **Spotify Connect / AirPlay:** a short message says to use the Spotify app or the casting device, since librespot has no local control interface.

### Neon Bars screensaver skin

A full-screen cyberpunk skin. Pick **Neon Bars · Donkey ベイビー** in the VU style menu.

* **Three neon bar meters: left, sub and right.** They read CamillaDSP's playback levels directly, so a 3-channel crossover config gets a live subwoofer meter. With a 2-channel config the sub column shows "offline". Each meter has an accurate dB scale, a live readout and peak hold, and goes amber above -6 dB and white-hot near 0.
* **A living city:** layered skyline with haze, traffic on elevated roads, flying cars, searchlights, gas flares, a holographic advert, neon shop signs, and distant motorbike riders. The foreground has wet-street reflections, puddle ripples, steam vents and drifting motes.
* **A hanging "DONKEY ♡ ベイビー" neon sign**, with the occasional flickering letter.
* **Now playing** in the top-left corner, including Spotify Connect titles from moOde's Spotify metadata, plus the sample rate, channel count and signal status.
* **Bass, treble and volume sliders** on a console under the meters. They use the same controls as the knobs.
* **Efficient:** it draws on its own canvas only while the screensaver is showing, and stops completely otherwise. If a device can't hold about 40 fps, it switches to a lighter mode with fewer effects.
* **Works offline:** fonts are bundled in `fonts/` (Tilt Neon, Orbitron, Share Tech Mono and a Noto Sans JP subset, all SIL OFL 1.1). `fetch-fonts.sh` re-downloads them.

New files: `extras.js` and `neonbars.js` (loaded by `index.html`), `tone.py`, `transport.py` and `fonts/`, with three small routes (`action=tone`, `action=transport`, `action=spotmeta`) in `mpd_bridge.php`. The helpers need `python3` and PyYAML, which moOde already includes.

## 🚀 Main Features

* **Complete Library Management:** Smooth music exploration by Albums, Artists, Folders (including NAS and USB), and advanced Web Radio management (with the ability to add custom stations and logos).
* **Adaptive (Responsive) Interface:** Layout designed to automatically scale and reorganize based on the device in use, featuring optimized views for Desktop (1080p), Tablet (landscape/portrait), and Smartphone.
* **Local Playback (HTTP Stream):** Ability to listen to the music playing on the Raspberry Pi directly through the client device's speakers (smartphone or PC) via HTTP stream.
* **Integrated Search Engine:** Quick search with specific filters (Title, Album, Artist, Genre, Folder, Radio) supported by a virtual on-screen keyboard.
* **Playlist and Queue Management:** Create, save, edit, and clear playback queues in real-time.
* **Multilingual Support:** Interface localized in English, Italian, French, and Spanish.

## 🎨 Design, Screensavers, and VU Meters (HTML5 Canvas)

The core strength of Mymoode Client is its screensaver graphics engine, written entirely in JavaScript (Canvas API), capable of reacting in real-time to the audio signal. 

Two main visual categories are included:

1. **Hi-Fi Studio Racks:** Faithful and animated reproductions of VU meters paying homage to the Golden Age of Hi-Fi. Available themes include:
   * *Blue Classic Mod. 70* (Inspired by iconic American blue lighting)
   * *Champagne Gold Mod. 73* (Warm Japanese golden style)
   * *Studio Master Mod. 77* (Strict and professional, Swiss recording studio aesthetic)
   * *VFD Peak Mod. 85* (1980s fluorescent digital display)
   * *And many other minimal, tube, and flat themes.*

2. **Vintage 3D Radios:** Models recreating the lighting, wood, and backlit glass dials of classic European and non-European parlor radios:
   * *Teutonia 54* & *Console '55* (Wooden cabinets and piano keys)
   * *Radica Mod. 58* & *Classic '35* (Dark bakelite and briar root structures)
   * *Solid State '68* (Homage to high-tech Japanese transistors)

## ⚙️ Advanced Technical Integrations

* **CamillaDSP Integration:** Direct control (ON/OFF) of the DSP processor and real-time RMS signal reading via WebSocket to animate the VU Meters with hardware precision, bypassing the limitations of browser audio analysis. *(In this fork the ON/OFF toggle is disabled on moOde 10; see [About this fork](#-about-this-fork).)*
* **Smart Home Ready (API Endpoints):** The system exposes dedicated URLs (e.g., `mpd_bridge.php?action=search&q={TEXT}&autoplay=true`) perfect for being called by **Home Assistant** or **Alexa** (via `rest_command`) to start music playback using voice commands.
* **Global Administration Panel:** Through `admin.html`, it is possible to configure default behaviors (Screensaver timeout, Default theme, Layout) that will be automatically distributed to any new tablet or smartphone connecting to the system.
* **Backup & Restore:** JSON format export and import of all UI preferences, saved radio stations, and user favorites.

## 🛠️ Installation

Installation is simple and automated for Debian/Raspberry Pi OS-based systems (assuming the moOde web environment is already configured on `/var/www/`).

1. Access your Raspberry Pi via SSH.
2. Navigate to the web root folder:
   ```bash
   cd /var/www
   ```
3. Clone the repository:
   ```bash
   git clone https://github.com/midnightcoup/MymoOde-MPD-client.git vumeter
   ```
4. Enter the directory and run the installation script:
   ```bash
   cd vumeter
   sudo chmod +x install.sh
   sudo ./install.sh
   ```
5. Open your browser and navigate to `http://[RASPBERRY-IP]/vumeter`

## ⚖️ Disclaimer of Warranty & Trademark Notice

**1. Warranty & Limitation of Liability**
This software, code, and graphical interface are provided **"as is"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the author or copyright holders be liable for any direct, indirect, incidental, special, exemplary, or consequential damages arising from the use, modification, or distribution of this software. **Use entirely at your own risk.**

**2. Trademark Notice**
All product names, logos, brands, trade names, and vintage radio aesthetics referenced, simulated, or visually adapted in this project are the property of their respective trademark holders. Their use within this project is strictly for nostalgic, aesthetic, and artistic representation purposes ("fan art" / historical tribute interface). This project is an independent, non-commercial hobbyist creation for open-source music players and is **not** affiliated, endorsed, sponsored, or officially connected with any of the respective trademark owners. No trademark infringement is intended. Any referenced content will be promptly removed upon request by the copyright or trademark owners.

## 🙏 Acknowledgments & Credits

A special and heartfelt thank you to the **moOde Audio** team for the dedication and high professionalism with which they develop and maintain their audio platform. This client was born as a complementary frontend interface for hobbyist use and would not have been possible without the solid foundation provided by moOde Audio and the **MPD (Music Player Daemon)** ecosystem.

* [moOde Audio Official Website](https://moodeaudio.org)
* Music Player Daemon (MPD)
* To the entire Open Source and DIYAudio community.

## 📺 Video Demo

Clicca sull'immagine qui sotto per vedere Mymoode MPD Client in azione:

[![Mymoode MPD Client Demo](https://img.youtube.com/vi/0-T8ZMdwZG8/maxresdefault.jpg)](https://youtu.be/0-T8ZMdwZG8)
