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

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as ExtensionUtils from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const useExternalApp = true;
let textThing = null;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    constructor(path) {
        super();
        this.path = path;
    }
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
                    if(Config.PACKAGE_VERSION.startsWith("3\.")) {
                        GLib.spawn_command_line_async('xterm -e watch sensors');
                    } else {
                        // this re-queries sensors every 2s, adding extra load to the machine
                        GLib.spawn_command_line_async(`gjs -m "${this.path}/infowindow.js"`);
                    }
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

                //Main.notify(_('clicked'));
            }
        });
    }
});

export default class MyExtension extends Extension{
    constructor(uuid) {
        super(uuid);
        this._uuid = uuid;
    }

    enable() {
        this._indicator = new Indicator(this.path);
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
