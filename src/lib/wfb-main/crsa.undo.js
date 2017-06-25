
var CrsaUndoState = function(page, name, force_cs) {

    var data = [];

    data.push({obj: page, data: page.sourceNode.toStringWithIds(true, service.getFormatHtmlOptions())});

    var ps = getCrsaPageStylesForPage(page.$iframe);

    for(var i = 0; i < ps.stylesheets.length; i++) {
        var cs = ps.stylesheets[i];
        if(cs.inline) continue;
        if((!cs.loaded || !cs.changed) && (force_cs !== cs)) continue;

        data.push({obj: cs, data: cs.genGetSource()});
    }

    data.push({obj: 'breakpoints', data: page.breakpoints.slice(0)});

    this.page = page;
    this.data = data;
    this.name = name;
    this.active = true;

    //console.log('UNDO RECORDED ' + name);

    var _this = this;

    this.apply = function(done) {
        var c = 0;
        var page_s = null;
        for(var i = 0; i < this.data.length; i++) {
            var s = this.data[i];

            if(s.obj === 'breakpoints') {
                page_s.obj.breakpoints = s.data;

            } else if(s.obj instanceof CrsaPage) {
                page_s = s;
            } else if(s.obj instanceof CrsaStylesheet) {
                c++;
                s.obj.changed = true;
                s.obj.genSetSource(s.data, function() {
                    c--;
                    if(c == 0) {
                        var parser = new pgParser();
                        parser.parse(page_s.data, function() {
                            page_s.obj.sourceNode = parser.rootNode;
                            if(done) done(_this);
                        });
                       /*
                        page_s.obj.setSource(page_s.data, function() {
                            if(done) done(_this);
                        });*/
                    }
                }, true);
            }

        }
        if(c == 0 && page_s) {
            var parser = new pgParser();
            parser.parse(page_s.data, function() {
                page_s.obj.sourceNode = parser.rootNode;
                if(done) done(_this);
            });
            /*
            page_s.obj.setSource(page_s.data, function() {
                if(done) done(_this);
            });*/
        }
    }
}

var CrsaPageUndoStack = function(page) {

    var stack = ko.observableArray([]);
    var pointer = ko.observable(-1);
    var last = 'undo';
    this.page = page;

    this.add = function(name, no_pointer, force_cs) {
        var d = new CrsaUndoState(this.page, name, force_cs);

        if(stack().length > pointer() + 1) {
            stack.splice(pointer() + 1, stack().length - (pointer() + 1));
        }
        stack.push(d);
        if(!no_pointer) {
            pointer(pointer() + 1);

            var max = 20;
            if(pointer() > max) {
                var diff = pointer() - max;
                stack.splice(0, diff);
                pointer(pointer() - diff);
                //console.log('Cleared ' + diff + ' from undo stack');
            }
        }
        return d;
    }

    this.isAtTheTip = function() {
        return pointer() >= 0 && stack().length == pointer() + 1;
    }

    this.remove = function() {
        if(pointer() < 0) {
            return null;
        }
        pointer(pointer() - 1);
        stack.splice(pointer() + 1, 1);
    }

    this.canUndo = ko.computed(function() {
        var x = last == 'undo' ? 0 : 1;
        return !(pointer() < 0 + x);
    });

    this.undo = function(done) {
        debugger;
        var x = last == 'undo' ? 0 : 1;
        if(pointer() < 0 + x) {
            if(done) done(null);
            return null;
        }
        if(last != 'undo') pointer(pointer() - 1);
        var d = stack()[pointer()];
        pointer(pointer() - 1);
        d.apply(done);
        last = 'undo';
        return d;
    }

    this.canRedo = ko.computed(function() {
        var x = last == 'undo' ? 2 : 1;
        return !(pointer() + x >= stack().length);
    });

    this.redo = function(done) {
        debugger;
        var x = last == 'undo' ? 2 : 1;
        if(pointer() + x >= stack().length) {
            if(done) done(null);
            return null;
        }
        pointer(pointer() + x);
        var d = stack()[pointer()];
        d.apply(done);
        last = 'redo';
        return d;
    }
}

var CrsaUndo = function() {

}
