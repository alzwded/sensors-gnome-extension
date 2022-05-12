/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* notes
cat log to check for errors
    $ journalctl -f -o cat /usr/bin/gnome-shell

enable/disable
    $ gnome-extensions enable example@shell.gnome.org

on wayland, run a nested gnome-shell
    dbus-run-session -- gnome-shell --nested --wayland

    After this is done you should see something like the following in the log:

    GNOME Shell started at Sat Aug 22 2020 07:14:35 GMT-0800 (PST)
    initializing Example Extension version 1
    enabling Example Extension version 1


*/

/* exported init */

const GETTEXT_DOMAIN = 'sensors-alzwded';

const { GObject, St, GLib, Gio } = imports.gi;
const Lang = imports.lang;
const ByteArray = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _ = ExtensionUtils.gettext;

const useExternalApp = true;
let textThing = null;

function mydirname() {
    let stack = new Error().stack.split('\n');
    let extensionStackLine;

    // Search for an occurrence of an extension stack frame
    // Start at 1 because 0 is the stack frame of this function
    for (let i = 1; i < stack.length; i++) {
        if (stack[i].includes('/gnome-shell/extensions/')) {
            extensionStackLine = stack[i];
            break;
        }
    }
    if (!extensionStackLine)
        return null;

    // The stack line is like:
    //   init([object Object])@/home/user/data/gnome-shell/extensions/u@u.id/prefs.js:8
    //
    // In the case that we're importing from
    // module scope, the first field is blank:
    //   @/home/user/data/gnome-shell/extensions/u@u.id/prefs.js:8
    let match = new RegExp('@(.+):\\d+').exec(extensionStackLine);
    if (!match)
        return null;

    // local import, as the module is used from outside the gnome-shell process
    // as well (not this function though)
    let extensionManager = imports.ui.main.extensionManager;

    let path = match[1];
    let file = Gio.File.new_for_path(path);

    // Walk up the directory tree, looking for an extension with
    // the same UUID as a directory name.
    while (file != null) {
        let extension = extensionManager.lookup(file.get_basename());
        if (extension !== undefined)
            return file.get_path();
        file = file.get_parent();
    }

    return null;
}


const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Sensors'));

        let myState = {
            lastOutput: ''
        };

        this.add_child(new St.Icon({
            icon_name: 'temperature-symbolic',
            style_class: 'system-status-icon',
        }));

        let item = new PopupMenu.PopupMenuItem(_('__placeholder__'));
        item.connect('activate', () => {
            try {
                //Main.notify(GLib.spawn_command_line_sync('pwd')[1].toString());
                //Main.notify(mydirname());
                if(useExternalApp) {
                    // this re-queries sensors every 2s, adding extra load to the machine
                    GLib.spawn_command_line_async(`gjs "${mydirname()}/infowindow.js"`);
                } else {
                    // this would be cool to just have it on screen;
                    // I need to clear it on click, though
                    if(!textThing) {
                        textThing = new St.Label({text: myState.lastOutput});
                        Main.uiGroup.add_actor(textThing);
                    }
                    let monitor = Main.layoutManager.primaryMonitor;
                    textThing.set_position(Math.floor(monitor.width / 2 - textThing.width / 2),
                                           Math.floor(monitor.height / 2 - textThing.height / 2));
                }
            } catch(e) {
                logError(e);
            }
        });
        this.menu.addMenuItem(item);

        this.menu.connect('open-state-changed', (self, open) => {
            if(open === true) {
                // FIXME some other means of getting rid of the text?
                //       I mean this should be its own window
                if(!useExternalApp) {
                    if(!textThing) {
                        textThing = new St.Label({text: myState.lastOutput});
                        Main.uiGroup.add_actor(textThing);
                    }
                }
                const sync = false;
                if(sync) {
                    let [, stdout, stderr, status] = GLib.spawn_command_line_sync("sensors");
                    if(status !== 0 || !(stdout instanceof Uint8Array)) {
                        // error happened
                        log('failed to spawn sensors');
                        item.label.text = 'error';
                        return;
                    } else {
                        let text = ByteArray.toString(stdout);
                        item.label.text = 'ok';
                    }
                } else {
                    let proc = Gio.Subprocess.new(
                        ['sensors'],
                        //['bash', '-c', 'sleep 1 && sensors'],
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );
                    proc.communicate_utf8_async(null, null, (proc, res) => {
                        try {
                            let[, stdout, stderr] = proc.communicate_utf8_finish(res);
                            if(proc.get_successful()) {
                                myState.lastOutput = stdout;
                                let lines = myState.lastOutput.split("\n").filter( line => line.includes("°C"));
                                //log(`I have ${lines.length} temperatures`);
                                item.label.text = lines.join("\n");
                            } else {
                                log('failed to spawn sensors & read output');
                                item.label.text = `error spawning 'sensors'`;
                            }
                        } catch(e) {
                            logError(e);
                        } finally {
                        }
                    });
                }

                //Main.notify(_('clicked'));
            }
        });
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        if(!useExternalApp) {
            if(textThing) {
                Main.uiGroup.remove_actor(textThing);
                textThing = null;
            }
        }
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
