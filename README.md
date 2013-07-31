# Node Server Bootstrap

This is simple clustered server base implementation. It defines a sane directory structure, implements a master process who manages a number of childs.

To be precise, this is basically a working template (hence the name Bootstrap). You can start your project with this codebase, and - hopefully - forget about the whole cluster and master process madness, and just write your worker server.

## Features

* Manager script to start, stop, restart your server
* Configuration file for development and production
* Worker thread lifetime management
* Modern and resource effective file change watcher to restart your workers when a file changes (even in production)

## Requirements

* Node v0.10.5+

That's it, no module dependencies, nice and simple.

## Warning

This is a new project, and it depends on experimental features in Node. I found it pretty stable, but you shouldn't trust my code in production unless you understood and tested it troughly!

Oh and don't expect any documentation at the moment, sorry!

## License

The MIT license.

Copyright (c) 2012 Péter Kovács (peter@kwep.me)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
