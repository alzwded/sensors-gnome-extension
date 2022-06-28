sensors Gnome extension
=======================

I wanted to write a Gnome extension and see how Gtk4 on JS is compared to Gtk2 on C from more than a decade ago.

I think I got it working. gnome-shell 42.0.

How to install&test this thing
------------------------------

...according to how much I know thus far.

1. Clone this.
2. `ln -s ~/.local/share/gnome-shell/extensions/sensors@alzwded.example.com sensors-gnome-extension`
3. Reboot?
4. `gnome-extensions enable sensors@alzwded.example.com` (or whatever name you gave the symbolink
5. It works?

Instead of rebooting, one can run 

```sh
dbus-run-session -- gnome-shell --nested --wayland
```

From that session, launch a terminal and `gnome-extensions enable sensors@alzwded.example.com`. Close session. Launch again. Extension should be there if there weren't any hiccups.

TODO
====

- [ ] cleanup
- [ ] figure out how these things get packaged
- [ ] figure out how these things get submitted
- [ ] replace infowindow.js Gtk/Gjs app with St stuff that eliminates the need of packaging a separate app; otherwise, may as well launch `gnome-terminal -- watch sensors`
