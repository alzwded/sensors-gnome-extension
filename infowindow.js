/* infowindow.js
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
import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
const mydirname = import.meta.dirname;

Gtk.init();

let app = new Gtk.Application();
app.title = 'sensors';
GLib.set_prgname('sensors');
app.connect('activate', () => {
    app.mywin.show();
});
app.connect('startup', () => {
    app.mywin = new Gtk.ApplicationWindow({
        application: app,
        title: 'sensors'
    });
    app.mywin.set_default_size(600, 400);
    let box = new Gtk.Box({orientation:Gtk.Orientation.VERTICAL});
    let scrolledWindow = new Gtk.ScrolledWindow();
    app.mywin.set_child(scrolledWindow);
    scrolledWindow.set_child(box);

    let buffer = new Gtk.TextBuffer();
    let text = `loading`;
    buffer.set_text(text, -1);
    let label = new Gtk.TextView();
    label.set_buffer(buffer);
    label.set_editable(false);
    label.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
    label.set_monospace(true);
    //label.set_line_wrap(true);
    //label.set_lines(5);
    box.append(label);

    let getSensors = () => {
        let proc = Gio.Subprocess.new(
            //['sensors'],
            ['bash', '-c', 'date && sensors'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let[, stdout, stderr] = proc.communicate_utf8_finish(res);
                if(proc.get_successful()) {
                    let ooo = stdout;
                    /*
                    let lines = lastOutput.split("\n").filter( line => line.includes("°C"));
                    log(`I have ${lines.length} temperatures`);
                    const ooo = lines.join("\n");
                    */
                    //buffer.set_text(ooo, new TextEcoder().encode(ooo).length); // but that's just silly
                    buffer.set_text(ooo, -1);
                } else {
                    log('failed to spawn sensors & read output');
                    const msg = `error spawning 'sensors'`;
                    buffer.set_text(msg, -1);
                }
            } catch(e) {
                logError(e);
            } finally {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, getSensors);
            }
        });
    };

    getSensors();

    try {
        app.mywin.set_icon_from_file(mydirname + '/icon.png');
    } catch(err) {
        // something something .desktop file? IDK; IDK how to make it work
        app.mywin.set_icon_name('temperature-symbolic');
    }
});

app.run(ARGV); // TODO argc/argv
