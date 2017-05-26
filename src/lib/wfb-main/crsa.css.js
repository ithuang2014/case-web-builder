var getRuleName = function(r) {
    if(r.selector) return r.selector;
    if(r.raw) shortenString(r.raw, 18);
    return 'Rule';
}

var normalizeSelector = function(sel) {
    var a = sel.split(',');
    for(var i = 0; i < a.length; i++) {
        a[i] = $.trim(a[i].replace("\n","").replace(/\s{2,}/ig," ").replace(/\s*>\s*/, '>'));
    }
    return a.join(',');//.toLowerCase();
}

var _crsaCss_re_classes = /\.-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g;
var _crsaCss_re_class = /^\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)$/;
var _crsaCss_re_id = /^\#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)$/;
var _crsaCss_re_tag = /^(-?[a-zA-Z]+[_a-zA-Z0-9-]*)$/;



var getClassesFromSelector = function(sel) {
    var m = sel.match(_crsaCss_re_classes);
    if(m) {
        var temp = {};
        for (var i = 0; i < m.length; i++)
            temp[m[i]] = true;
        var r = [];
        for (var k in temp) {
            r.push(k);
        }
        //console.log(r);
        return r;
    }
    return null;
}

var getClassFromSelector = function(sel) {
    var m = sel.match(_crsaCss_re_class);
    return m ? m[1] : null;
}

var getIdFromSelector = function(sel) {
    var m = sel.match(_crsaCss_re_id);
    return m ? m[1] : null;
}

var getTagFromSelector = function(sel) {
    var m = sel.match(_crsaCss_re_tag);
    return m ? m[1] : null;
}

function setRuleInfo(i) {
    if(i.raw) {
        i.type = 'raw';
    } else if(i.selector) {
        i.classes = getClassesFromSelector(i.selector);
        var cls = getClassFromSelector(i.selector);
        if(cls) {
            i.type = 'class';
            i.class = cls;
        } else {
            var eid = getIdFromSelector(i.selector);
            if(eid) {
                i.type = 'element_id';
                i.element_id = eid;
            } else {
                var tag = getTagFromSelector(i.selector);
                if(tag) {
                    i.type = 'tag';
                    i.tag = tag;
                } else {
                    i.type = 'composite';
                }
            }
        }
    } else {
        i.type = 'unknown';
    }
    return i;
}


(function( $ ) {
    window.CrsaSimpleCssParser = function() {
        this.rules = [];

        var _this = this;

        this.parse = function(css, crsa_stylesheet) {
            this.rules = [];

            var current_rule = '';
            var level = 0;
            var selector = '';
            var body = '';
            var naked_body = '';
            var spaced = true;
            var in_comment = false;
            var comment = '';

            var mediaParser = new CrsaSimpleCssParser();

            var skipQuote = function(q, c) {
                var start = c.i;
                var i = c.i;
                var str = c.str;
                while(i < str.length) {
                    var ch = str.charAt(i);
                    if(ch == q) {
                        var pch = i - 1 >= start ? str.charAt(i-1) : '';
                        var ppch = i - 2 >= start ? str.charAt(i-2) : '';

                        if(pch != '\\' || (pch == '\\' && ppch == '\\')) {
                            i++;
                            c.i = i;
                            return;
                        }
                    }
                    i++;
                }
                c.i = i;
            }

            var removeComments = function(str) {
                var o = [];
                var i = 0;
                var in_quote = false;
                var cur = 0;

                var addToO = function() {
                    if(i > cur) {
                        o.push(str.substr(cur, i - cur));
                        cur = i;
                    }
                }



                while(i < str.length) {
                    var ch = str.charAt(i);
                    var nch = i < str.length-1 ? str.charAt(i+1) : '';
                    var pch = i > 0 ? str.charAt(i-1) : '';

                    var inc_done = false;

                    if(ch == '\'' || ch == '"') {
                        addToO();
                        i++;
                        var c = {i: i, str: str};
                        skipQuote(ch, c);
                        i = c.i;
                        continue;
                    } else if(ch == '(') {
                        addToO();
                        i++;
                        var c = {i: i, str: str};
                        skipQuote(')', c);
                        i = c.i;
                        continue;
                    } else {
                        if(ch == '/' && nch == '/') {
                            // double // comment
                            addToO();
                            var idx = str.indexOf("\n", i);
                            if(idx < i) idx = str.length;
                            cur = idx + 1;
                            i = cur;
                            inc_done = true;
                        } else if(ch == '/' && nch == '*') {
                            addToO();
                            var idx = str.indexOf("*/", i);
                            if(idx < i) idx = str.length;
                            cur = idx + 2;
                            i = cur;
                            inc_done = true;
                        } else {

                        }
                    }
                    if(!inc_done) i++;
                }
                addToO();
                return o.join('');
                //return str.replace(/(\/\*[\w\'\s\r\n\*]*\*\/)|(\/\/[\w\s\']*)|(\<![\-\-\s\w\>\/]*\>)/g,'');
            }


            var addCurrent = function() {
                selector = $.trim(selector);
                body = $.trim(body);
                comment = $.trim(comment);
                naked_body = $.trim(naked_body);

                if(selector.length > 0 || body.length > 0 || comment.length > 0) {
                    var r;
                    if(comment.length > 0) {
                        r = {};
                        r.less_type = 'Comment';
                        r.raw = comment;
                        r.crsa_stylesheet = crsa_stylesheet;
                        setRuleInfo(r);
                        r.index = _this.rules.length;
                        _this.rules.push(r);

                        if(selector.length) {
                            //h1 /* comment */ { ... }
                            comment = '';
                            return;
                        }
                    } else {
                        if(selector.match(/^@media/ig)) {
                            if(naked_body.length > 0) {
                                mediaParser.parse(naked_body);
                                $.each(mediaParser.rules, function(i, mr) {
                                    r = {};
                                    r.media = $.trim(selector.replace(/^@media/i, ''));
                                    if(mr.values) r.values = mr.values;
                                    if(mr.selector) r.selector = mr.selector;
                                    if(mr.raw) r.raw = mr.raw;
                                    r.crsa_stylesheet = crsa_stylesheet;
                                    setRuleInfo(r);
                                    r.index = _this.rules.length;
                                    _this.rules.push(r);
                                });
                            } else {
                                r = {};
                                r.raw = selector + body;
                                r.crsa_stylesheet = crsa_stylesheet;
                                setRuleInfo(r);
                                r.index = _this.rules.length;
                                _this.rules.push(r);
                            }
                        } else if(selector.indexOf('@') == 0) {
                            r = {};
                            r.raw = selector + body;
                            r.crsa_stylesheet = crsa_stylesheet;
                            setRuleInfo(r);
                            r.index = _this.rules.length;
                            _this.rules.push(r);
                        } else if(selector.length > 0 && body.length > 0) {
                            r = {};
                            r.selector = selector;
                            //r.raw = selector + body;
                            r.values = {};

                            naked_body = removeComments(naked_body);
                            var values = [];//naked_body.split(/;/g);

                            //console.log(naked_body);

                            var i = 0;
                            var cur = 0;
                            var len = naked_body.length;

                            while(i < len) {
                                var ch = naked_body.charAt(i);
                                if(ch == '\'' || ch == '"' || ch == '(') {
                                    i++;
                                    var c = {str: naked_body, i: i};
                                    skipQuote(ch == '(' ? ')' : ch, c);
                                    i = c.i;
                                } else {
                                    if(ch == ';') {
                                        if(i > cur) {
                                            values.push(naked_body.substr(cur, i - cur));
                                            cur = i + 1;
                                        }
                                    }
                                    i++;
                                }
                            }
                            if(i > cur) {
                                values.push(naked_body.substr(cur, i - cur));
                            }

                            $.each(values, function(j, val) {
                                val = $.trim(val);
                                //console.log(val);
                                if(val.length > 0) {
                                    var idx = val.indexOf(':');
                                    if(idx > 0) {
                                        var v = {};
                                        v.name = $.trim(val.substr(0, idx));
                                        v.value = idx < val.length - 1 ? $.trim(val.substr(idx + 1)) : null;
                                        v.important = v.value ? (v.value.match(/\!important/i) != null) : false;

                                        if(r.values.hasOwnProperty(v.name)) {
                                            r.raw = selector + ' ' + body;
                                            r.multiple_values = true;
                                            delete r.values;
                                            return false;
                                        } else {
                                            r.values[v.name] = v;
                                        }
                                    }
                                }
                            });
                            r.crsa_stylesheet = crsa_stylesheet;
                            setRuleInfo(r);
                            r.index = _this.rules.length;
                            _this.rules.push(r);
                        }
                    }
                }
                selector = '';
                body = '';
                comment = '';
                naked_body = '';
            }
            var i = 0;
            var ch = '';
            var pch;
            var nch = css.charAt(0);
            var in_func = 0;

            //debugger;
            while(i < css.length) {
                ch = css.charAt(i);
                nch = i < css.length-1 ? css.charAt(i+1) : '';

                if(level == 0 && ch == '/' && nch == '*') {
                    in_comment = true;
                } else if(in_comment && ch == '*' && nch == '/') {
                    in_comment = false;
                    comment += '*/';
                    addCurrent();
                    i = i + 2;
                    continue;
                }
                if(in_comment) {
                    comment += ch;
                } else {

                    if(ch == '{') {
                        level++;
                        body += ch;
                        if(level > 1) naked_body += ch;

                    } else if(ch == '}') {
                        if(level > 0) {
                            level--;
                            body += ch;
                            if(level > 0) naked_body += ch;
                        }
                        if(level == 0) {
                            addCurrent();
                        }
                    } else {

                        if(level == 0) {
                            selector += ch;

                            if(ch == '(') {
                                in_func++;
                            } else if(ch == ')') {
                                in_func--;
                                if(in_func < 0) in_func = 0;
                            }
                            if(ch == ';' && in_func == 0) {
                                addCurrent();
                            }
                        } else {
                            body += ch;
                            naked_body += ch;
                        }
                    }
                }
                i++;
            }
            selector = $.trim(selector);
            if(selector.length > 0) {
                if(level > 0) {
                    for(var n = level; n > 0; n--) {
                        body += '}';
                    }
                }
                addCurrent();
            }
        }
    }


    /*
    var test = new CrsaSimpleCssParser();
        var css = 'h / * c * / { c:r;}';
        test.parse(css);
        console.log(test.rules);
        return;
    */


    window.CrsaVariable = function() {
        this.name = null;
        this.value = null;
        this.cs = null;
        this.global = false;

        this.isInUse = function() {
            var re = new RegExp(escapeRegExp(this.name) + '\\W','i');
            for(var i = 0; i < crsaStylesheets.length; i++) {
                var cs = crsaStylesheets[i];
                var s = cs.genGetSourceForRules(cs.crsa_rules);//will skip variable definition
                if(s.match(re)) return true;
            }
            return false;
        }

        this.valueChanged = function(v, done) {
            this.value = v;
            this.cs.less_source = null;
            this.cs.changed = true;
            var cs_list = this.global ? crsaStylesheets : [this.cs];
            var c = 0;
            $.each(cs_list, function(i,cs) {
                c++;
                cs.genRegenerateAndSetCssSource(function() {
                    c--;
                    if(c == 0 && done) done();
                }, false);
            });
        }
    }

    window.CrsaVariables = function() {
        this.list = [];

        var _this = this;

        this.findByName = function(name, cs) {
            var r = null;
            $.each(this.list, function(i,v) {
                if(v.cs == cs && v.name == name) {
                    r = v;
                    return false;
                }
            });
            return r;
        }

        this.add = function(name, value, cs) {
            var v = this.findByName(name, cs);
            if(!v) {
                v = new CrsaVariable();
                v.name = name;
                v.cs = cs;
                this.list.push(v);
            }
            v.value = value;
            return v;
        }

        this.remove = function(v, done) {
            var idx = this.list.indexOf(v);
            if(idx >= 0) this.list.splice(idx, 1);
            if(v.cs) {
                v.cs.less_source = null;
                v.cs.genRegenerateAndSetCssSource(function() {
                    $('body').trigger('crsa-stylesheets-changed');
                    if(done) done();
                });
            }
        }

        this.getVarsForCs = function(cs, include_global) {
            var r = [];
            $.each(this.list, function(i,v) {
                if(v.cs == cs || (include_global && v.global)) r.push(v);
            });
            return r;
        }

        this.getAllVars = function() {
            var r = [];
            $.each(crsaStylesheets, function(i,cs) {
                r = r.concat(_this.getVarsForCs(cs, false));
            })
            return r;
        }

        this.removeVarsForCs = function(cs) {
            var r = [];
            $.each(this.list, function(i,v) {
                if(v.cs != cs) r.push(v);
            });
            this.list = r;
        }
    }

    window.CrsaStylesheet = function() {
        this.less_source = null;
        this.less_tree = null;
        this.crsa_rules = [];
        this.less_variables = {};
        this.less_variables_string = '';
        this.css_source = '';
        this.url = null;
        this.localFile = null;
        this.name = null;
        this.dom_ss = [];
        this.changed = false;
        this.less_error = null;
        this.loaded_type = null;
        this.inline = false;
        this.loaded = false;
        this.less_mode = true;
        this.has_less_file = false;
        this.ignore = false;

        var _this = this;

        var less_enabled_in_pg = service.getSetting('use-less', '1') == '1';

        this.getLocalFileName = function() {
            if(!this.localFile) return null;
            if(this.genGetType() == 'less') {
                return this.localFile.replace(/\.css$/i, '.less');
            } else {
                return this.localFile;
            }
        }

        this.genGetType = function() {
            if(this.loaded_type && this.loaded_type != 'css') return this.loaded_type;
            if(this.usesLessFeatures()) return 'less';
            return 'css';
        }

        this.genSetSource = function(source, done, skip_vars) {
            switch(this.genGetType()) {
                case 'less':
                    this.setLessSource(source, done, skip_vars);
                    break;
                default:
                    var cp = new CrsaSimpleCssParser();
                    cp.parse(source, _this);
                    this.crsa_rules = cp.rules;
                    this.setAllCssText(source, cp.rules);
                    setTimeout(function() {
                        if(done) done();
                    },10);
                    break;
            }
        }

        this.genGetSource = function() {
            switch(this.genGetType()) {
                case 'less':
                    return this.getLessSource();
                    break;
                default:
                    if(!this.css_source) {
                        this.css_source = this.genGetSourceForRules();
                    }
                    return this.css_source;
                    break;
            }
        }

        this.genForgetCachedSource = function() {
            this.less_source = null;
            this.css_source = null;
        }

        this.genRegenerateAndSetCssSource = function(done, process_rules, skip_vars) {
            if(typeof process_rules == 'undefined') process_rules = true;
            if(typeof skip_vars == 'undefined') skip_vars = false;

            switch(this.genGetType()) {
                case 'less':
                    this.regenerateAndSetCssSource(done, process_rules, skip_vars);
                    break;
                default:
                    var css = this.genGetSourceForRules();
                    if(process_rules) {
                        this.genSetSource(css, done)
                    } else {
                        this.setAllCssText(css);
                        setTimeout(function() {
                            if(done) done();
                        },10);
                        break;
                    }
            }
        }

        this.genRegenerateCssFromSource = function(done, process_rules, skip_vars) {
            if(typeof process_rules == 'undefined') process_rules = true;
            if(typeof skip_vars == 'undefined') skip_vars = false;

            switch(this.genGetType()) {
                case 'less':
                    this.regenerateCssFromLessSource(done, process_rules, skip_vars);
                    break;
                default:
                    var css = this.genGetSourceForRules();

                    if(process_rules) {
                        this.genSetSource(css, function() {
                            if(done) done(css);
                        });
                    } else {
                        this.css_source = css;
                        setTimeout(function() {
                            if(done) done(css);
                        },10);
                    }
                    break;
            }
        }

        this.genGetSourceForRules = function(rules) {
            return this.getLessSourceForRules(rules);
        }

        this.genGetSourceHtmlForRule = function(rule) {
            return this.getLessSourceHtmlForRule(rule);
        }

        this.genGetError = function() {
            switch(this.genGetType()) {
                case 'less':
                    return this.less_error;
                    break;
                default:
                    break;
            }
            return null
        }

        this.genRegenerateRule = function(rule, done) {
            switch(this.genGetType()) {
                case 'less':
                    this.regenerateLessRule(rule, done);
                    break;
                default:
                    this.cssRuleValueChanged(rule, null, null, done);
                    break;
            }
        }

        this.genRuleValueChanged = function(rule, name, value, done, no_refresh) {
            switch(this.genGetType()) {
                case 'less':
                    this.lessRuleValueChanged(rule, name, value, done, no_refresh);
                    break;
                default:
                    this.cssRuleValueChanged(rule, name, value, done, no_refresh);
                    break;
            }
        }

        this.genFindRules = function(sel) {
            return this.findLessRules(sel);
        }

        this.unload = function() {
            crsaVariables.removeVarsForCs(this);

            this.setLocalFile(null);
            if(_this.watchReloadDialog) {
                try {
                    _this.watchReloadDialog.modal('hide');
                }
                catch(err) {}
            }
        }

        this.setUrl = function(url) {
            this.url = url;
            this.name = url.split("/").pop();

            var localFile = crsaIsFileUrl(url) ? crsaMakeFileFromUrl(url) : null;

            if(localFile != this.localFile) {
                this.setLocalFile(localFile);
            }
        }

        this.setLocalFile = function(file) {
            if(this.isWatchingFileForChanges && this.localFile) {
                this.stopWatchingFileForChanges();
            }
            if(this.has_less_file && file) {
                file = file.replace(/\.css$/i, '.less');
            }
            this.localFile = file;//crsaIsFileUrl(url) ? crsaMakeFileFromUrl(url) : null;

            if(this.localFile) {
                this.watchFileForChanges();
            }
        }


        this.loadInline = function(sheet, done) {

            var doneasync = function(a,b,c) {
                setTimeout(function() {
                    done(a,b,c);
                },1);
            }

            if(!sheet.ownerNode) {
                if(done) doneasync();
            }
            this.name = '(inline)';
            var $ss = $(sheet.ownerNode);
            var css = $ss.html();
            this.loaded_type = 'css';
            this.loaded = true;
            this.inline = true;
            this.genSetSource(css, doneasync());
        }

        this.watchFileOnFileChanged = function(curr, prev) {
            //console.log('ccccccccc');
            //return;
            var fs = require('fs');

            if(curr.mtime > prev.mtime && service.getSetting('auto-reloading', '1') == '1') {
                var ct = (new Date()).getTime();
                if(ct - _this.lastSavedAt > 5000) {
                    console.log(_this.url + ' changed');

                    var fileName = crsaMakeFileFromUrl(_this.url);
                    var code = fs.readFileSync(fileName, {encoding: "utf8"});

                    service.codeEditors.isCodeForUrlSameInExternalEditor(crsaMakeUrlFromFile(_this.localFile), code, function(same) {

                        if(_this.watchReloadDialog) {
                            try {
                                _this.watchReloadDialog.modal('hide');
                                _this.watchReloadDialog = null;
                            } catch(err) {}
                        }

                        if(same) {
                            service.callGlobalFrameworkHandler('on_css_loaded_from_external', _this);
                            return;
                        }

                        if(_this.changed) {

                            _this.watchReloadDialog = showAlert('<p><b>' + _this.name + '</b> was modified outside of Pinegrow. The file has unsaved changes. Do you want to reload it?</p><p><em>You can disable auto-reloading in Support -&gt; Settings.</em></p>',  "Unsaved file modified outside of Pinegrow", "Don't reload", "Reload", function() {
                                _this.watchReloadDialog = null;
                            }, function() {
                                _this.watchReloadDialog = null;
                                _this.reload(function() {

                                    $('body').trigger('crsa-stylesheets-changed');
                                    service.callGlobalFrameworkHandler('on_css_loaded_from_external', _this);
                                });
                            });
                        } else {
                            _this.reload(function() {
                                $('body').trigger('crsa-stylesheets-changed');
                                service.callGlobalFrameworkHandler('on_css_loaded_from_external', _this);
                            });
                        }
                    })
                } else {
                    // console.log(_this.localFile + ' changed in PG');
                }
            }
        }

        this.isWatchingFileForChanges = false;
        this.lastSavedAt = 0;
        this.watchReloadDialog = null;

        this.watchFileForChanges = function() {
            if(this.localFile && service.getSetting('auto-reloading', '1') == '1') {
                var fs = require('fs');
                fs.watchFile(this.localFile, {persistent: true, interval: 1102}, this.watchFileOnFileChanged);
                this.isWatchingFileForChanges = true;
            }
        }

        this.stopWatchingFileForChanges = function() {
            if(this.localFile && this.isWatchingFileForChanges) {
                var fs = require('fs');
                fs.unwatchFile(this.localFile, this.watchFileOnFileChanged);
                this.isWatchingFileForChanges = false;
            }
        }

        this.reload = function(done) {
            this.load(this.url, done, true);
        }

        this.load = function(url, done, force) {
            var naked_url = service.httpServer.getOriginalUrl(crsaRemoveUrlParameters(url));
            url = service.httpServer.getOriginalUrl(url);
            this.setUrl(url);


            var doneasync = function(a,b,c) {
                //console.log('doneasync');
                if(done) {
                    setTimeout(function() {
                        //console.log('doneasync call');
                        done(_this, a,b,c);
                        //console.log('doneasync called');
                    },1);
                }
            }

            if(this.ignore && !force) {
                doneasync();
                return;
            }


            /*
            if(naked_url.indexOf('.less') >= 0) {
                done();
                return;
            }
            */

            var lessurl = naked_url.replace(/\.css$/i, '.less');
            if(lessurl == naked_url) {
                lessurl += '.less';
            }
            var fs = require('fs');

            var loadCss = function() {
                _this.loaded_type = 'css';
                if(isApp() && crsaIsFileUrl(url)) {
                    try {
                        //debugger;
                        var fileName = crsaMakeFileFromUrl(url);
                        var str = fs.readFileSync(fileName, {encoding: "utf8"});
                        console.log('loaded css ' + url);

                        _this.genSetSource(str, function() {
                            _this.changed = false;
                            _this.loaded = true;
                            doneasync();

                            _this.setLocalFile(fileName);
                        });

                    } catch(err) {
                        _this.genSetSource('', doneasync);
                    }
                } else {
                    $.ajax({
                        url: url,
                        data: null,
                        dataType: 'text'
                    }).done(function(data) {
                            console.log('loaded css ' + url);
                            _this.genSetSource(data, function() {
                                _this.changed = false;
                                _this.loaded = true;
                                doneasync();
                            });
                        }).fail(function() {
                            _this.loaded = true;
                            _this.genSetSource('', doneasync);
                        });
                }
            }

            //loadCss();
            //return;

            if(isApp() && crsaIsFileUrl(lessurl) && less_enabled_in_pg) {
                try {

                    var fileName = crsaMakeFileFromUrl(lessurl, true);
                    var str = fs.readFileSync(fileName, {encoding: "utf8"});
                    console.log('loaded ' + lessurl);
                    _this.has_less_file = true;
                    _this.setLessSource(str, function() {
                        if(_this.less_error) {
                            console.log('invalid less ' + lessurl);
                            //loadCss();
                            _this.loaded = true;
                            _this.loaded_type = 'less';
                            doneasync();
                        } else {
                            _this.loaded = true;
                            console.log('loaded less ' + lessurl);
                            _this.loaded_type = 'less';
                            _this.changed = false;
                            doneasync();
                        }
                        _this.setLocalFile(fileName);
                    });
                } catch(err) {
                    loadCss();
                }
            } else {
                if(less_enabled_in_pg) {
                    console.log("Loading " + lessurl);
                    $.ajax({
                        url: lessurl,
                        data: null,
                        dataType: 'text'
                    }).done(function(data) {
                            console.log('loaded ' + lessurl);
                            _this.has_less_file = true;
                            _this.setLessSource(data, function() {
                                if(_this.less_error) {
                                    console.log('invalid less ' + lessurl);
                                    _this.has_less_file = false;
                                    loadCss();
                                    //doneasync();
                                } else {
                                    _this.loaded = true;
                                    console.log('loaded less ' + lessurl);
                                    _this.loaded_type = 'less';
                                    _this.changed = false;
                                    doneasync();
                                }
                            });
                        }).fail(function() {
                            console.log('Failed loading ' + lessurl);
                            loadCss();
                        });
                } else {
                    loadCss();
                }
            }
        }

        this.shouldSaveLess = function() {
            return this.has_less_file || this.usesLessFeatures();
        }

        this.usesLessFeatures = function() {
            if(!less_enabled_in_pg) return false;
            var vars = crsaVariables.getVarsForCs(this, true);
            if(vars.length) return true;
            return false;
            for(var i = 0; i < this.crsa_rules.length; i++) {
                var r = this.crsa_rules[i];
                if(r.raw) {
                    if(r.raw.indexOf('@import') >= 0 && r.raw.match(/\.less['"]/)) {
                        return true;
                    }
                } else if(r.values) {
                    var found = false;
                    $.each(r.values, function(ii,s) {
                        if(ii.length && ii.charAt(0) == '.') {
                            found = true;
                            return false;
                        }
                    });
                    if(found) return true;
                }
            }
            return false;
        }

        this.save = function(path, done, fs, filter_func, fileWriter) {
            if(!fs) fs = require('fs');
            var cs = this;

           // debugger;
            cs.getCssSource(function(css) {
                setTimeout(function() {
                    if(css === null) {
                        //couldn't get css source?, dont save
                        done('Error getting CSS source.');
                        return;
                    }
                    try{
                        if(filter_func) css = filter_func(css);

                        if(fileWriter) {
                            fileWriter.writeFile(path, css, function() {
                                _this.lastSavedAt = (new Date()).getTime();
                                console.log('saved css path ' + path);
                            })
                        } else {
                            crsaWriteFileWithBackup(fs, path, css, "utf8");
                            _this.lastSavedAt = (new Date()).getTime();
                            console.log('saved css path ' + path);
                        }

                        if(_this.shouldSaveLess()) {
                            var less = cs.getLessSource();
                            if(filter_func) less = filter_func(less);
                            cs.has_less_file = true;

                            var less_name = path.replace(/\.css$/i, '.less');
                            if(less_name == path) less_name += '.less';

                            if(fileWriter) {
                                fileWriter.writeFile(less_name, less, function() {
                                    _this.lastSavedAt = (new Date()).getTime();
                                    console.log('saved less path ' + less_name);
                                })
                            } else {
                                crsaWriteFileWithBackup(fs, less_name, less, "utf8");
                                _this.lastSavedAt = (new Date()).getTime();
                                console.log('saved less file ' + less_name);
                            }
                            /*
                            var sass_source = _this.getSassSourceForRules();
                            if(filter_func) sass_source = filter_func(sass_source);
                            var sass_name = path.replace(/\.css$/i, '.scss');
                            if(sass_name == path) sass_name += '.scss';

                            if(fileWriter) {
                                fileWriter.writeFile(sass_name, sass_source, function() {
                                })
                            } else {
                                crsaWriteFileWithBackup(fs, sass_name, sass_source, "utf8");
                                console.log('saved scss file ' + sass_name);
                            }
                            */
                        }

                        cs.changed = false;
                        if(crsaIsFileUrl(cs.url)) {
                            //leave remote css urls intact
                            cs.setUrl(crsaMakeUrlFromFile(path));
                        }

                        if(done) done();


                    }
                    catch(err) {
                        done(err);
                    }
                }, 10);
            });
        }


        var getCssRulesList = function() {
            switch(_this.genGetType()) {
                case 'less':
                    return null;
                    break;
                default:
                    return this.crsa_rules;
                    break;
            }
        }


        this.attachTo = function(iframe, ss, done, $replaceElement) {
            if(ss) {
                if(this.dom_ss.indexOf(ss) < 0) {
                    this.dom_ss.push(ss);
                    if((_this.changed || true) && _this.loaded && !_this.genGetError()) {
                        _this.getCssSource(function(css) {
                            if(!_this.genGetError()) {
                                _this.setAllCssTextForPage(null, ss, css, getCssRulesList());
                            }
                            if(done) done();
                        });
                    } else {
                        if(done) done();
                    }
                }
            } else {
                var doc = getIframeDocument(iframe);
                var rel_url = crsaMakeLinkRelativeTo(this.url, getCrsaPageForIframe($(iframe)).url);
                rel_url = service.getProxyUrl(rel_url);
                var link = loadStyleSheet(iframe, rel_url, function(ss) {
                    _this.dom_ss.push(ss);

                    if(_this.loaded) {
                        _this.getCssSource(function(css) {
                            if(!_this.genGetError()) {
                                _this.setAllCssTextForPage(null, ss, css);
                            }
                            if(done) done();
                        });
                    } else {
                        if(done) done();
                    }
                }, $replaceElement);
                if(iframe) {
                    getCrsaPageForIframe($(iframe)).setPageChanged(true);
                }
            }

        }

        this.detachFrom = function(iframe) {
            var found_ss = this.findAttachmentFor(iframe);
            if(found_ss) {
                var ind = this.dom_ss.indexOf(found_ss);
                var pgLink = new pgQuery($(found_ss.ownerNode));
                pgLink.remove();
                //$(found_ss.ownerNode).remove();
                this.dom_ss.splice(ind, 1);
            }
            if(iframe) {
                getCrsaPageForIframe($(iframe)).setPageChanged(true);
            }
        }

        this.reattachToAll = function(done) {
            this.cleanDomSs();

            var c = 0;
            var list = this.dom_ss;
            this.dom_ss = [];
            if(list.length == 0) {
                if(done) done();
                return;
            }
            for(var i = 0; i < list.length; i++) {
                var $el = $(list[i].ownerNode);
                var iframe = getIframeOfElement($el).get(0);
                c++;
                this.attachTo(iframe, null, function() {
                    c--;
                    if(c == 0 && done) done();
                }, $el);
            }
        }

        this.cleanDomSs = function() {
            var list = this.dom_ss;
            this.dom_ss = [];

            for(var i = 0; i < list.length; i++) {
                if(!list[i].ownerNode) continue;
                var $el = $(list[i].ownerNode);
                var iframe = getIframeOfElement($el);
                if(!iframe) continue;
                this.dom_ss.push(list[i]);
            }
        }

        this.getAttachedToPages = function() {
            var r = [];
            var needsClean = false;
            for(var i = 0; i < this.dom_ss.length; i++) {
                if(this.dom_ss[i].ownerNode) {
                    var iframe = getIframeOfElement($(this.dom_ss[i].ownerNode));
                    if(iframe) {
                        r.push(iframe);
                    } else {
                        needsClean = true;
                    }
                } else {
                    needsClean = true;
                }
            }
            if(needsClean) {
                this.cleanDomSs();
            }
            return r;
        }

        this.duplicate = function(done) {

            var n = new CrsaStylesheet();

            n.name = this.name.replace(/\.(css|less)($|[\?\/])/i, ".copy.$1");

            var a = this.url.split("/");
            if(a.length > 0) {
                a.splice(a.length-1,1);
            } else {
                a = [""];
            }
            n.url = a.join("/") + "/" + n.name;

            n.changed = true;
            n.loaded_type = this.loaded_type;
            //n.less_source = this.getLessSource();
            n.less_variables = this.less_variables;
            n.less_variables_string = this.less_variables_string;
            n.loaded = this.loaded;
            n.ignore = this.ignore;
            n.has_less_file = this.has_less_file;
            //n.css_source = this.css_source;

            n.genSetSource(this.genGetSource(), function() {
                if(done) done(n);
            });
            /*
            n.genRegenerateCssFromSource(function() {
                if(done) done(n);
            });
            */
            return n;
        }

        this.findAttachmentFor = function(iframe) {
            var doc = getIframeDocument(iframe);
            for(var i = 0; i < this.dom_ss.length; i++) {
                var ss = this.dom_ss[i];
                if(ss && ss.ownerNode && ss.ownerNode.ownerDocument == doc) {
                    return ss;
                }
            }
            return null;
        }

        this.isEnabledForPage = function(iframe) {
            var ss = this.findAttachmentFor(iframe);
            return ss ? ss.disabled == false : false;
        }

        this.setEnabledForPage = function(iframe, enabled) {
            var ss = this.findAttachmentFor(iframe);
            if(ss) ss.disabled = !enabled;
        }



        var breakpoints_units_re = '(px|em|rem|pt)';

        this.getBreakpoints = function() {
            var doTask = function() {
                var unit_re = new RegExp(breakpoints_units_re, 'i');
                var re = new RegExp("([0-9\.]+)" + breakpoints_units_re,"g");
                var list = [];
                if(_this.crsa_rules) {
                    for(var i = 0; i < _this.crsa_rules.length; i++) {
                        if(_this.crsa_rules[i].media) {
                            var m = _this.crsa_rules[i].media.match(re);
                            if(m) {

                                for(var n = 0; n < m.length; n++) {
                                    var cv = crsaSplitCSSValue(m[n]);
                                    var b = cv.value;
                                    var unit = cv.unit;

                                    var mm = _this.crsa_rules[i].media.match(new RegExp("max\\-width\\:\\s*" + b + unit));
                                    if(mm) {
                                        crsaOneUpCSSValue(cv);
                                    }
                                    b = cv.value + cv.unit;

                                    if(list.indexOf(b) < 0) {
                                        list.push(b);
                                    }
                                }
                            }
                        }
                    }
                }
                return list;
            }
            return doTask();
        }


        this.changeBreakpoint = function(old, b, done) {
            var doTask = function() {
                var re = new RegExp(":\\s*" + escapeRegExp(old),"g");

                var cv = crsaSplitCSSValue(old);
                var cvdown = crsaOneUpCSSValue(cv, -1);

                var cvb = crsaSplitCSSValue(b);
                var cvbdown = crsaOneUpCSSValue(cvb, -1);

                var re_small = new RegExp(":\\s*" + escapeRegExp(cvdown.value + cvdown.unit),"g");

                var list = [];
                var changed = false;
                //debugger;
                if(_this.crsa_rules) {
                    for(var i = 0; i < _this.crsa_rules.length; i++) {
                        if(_this.crsa_rules[i].media) {

                            var nm = _this.crsa_rules[i].media.replace(re, ": " + b);
                            nm = nm.replace(re_small, ": " + (cvbdown.value + cvbdown.unit));

                            if(nm != _this.crsa_rules[i].media) {
                                _this.crsa_rules[i].media = nm;
                                changed = true;
                            }
                        }
                    }
                    if(changed) {
                        _this.less_source = null;
                        _this.css_source = null;
                        _this.changed = true;
                        _this.genSetSource(_this.genGetSource(), function() {
                            if(done) done(true);
                        });
                    } else {
                        if(done) done(false);
                    }
                } else {
                    if(done) done(false);
                }

            }
            return doTask();
        }


        this.addRule = function(selector, values) {
            var r = {selector: selector, values: values, crsa_stylesheet: this};
            setRuleInfo(r);
            r.index = this.crsa_rules.length;
            this.crsa_rules.push(r);
            this.less_source = null;
        }

        this.addLessRule = function(selector, values) {
            if(!values) values = {};
            var r = {selector : selector, values : values};
            setRuleInfo(r);
            r.index = this.crsa_rules.length;
            this.crsa_rules.push(r);
            this.less_source = null;
            this.changed = true;
            return r;
        }

        this.removeLessRule = function(rule) {
            var i = this.crsa_rules.indexOf(rule);
            if(i >= 0) {
                this.crsa_rules.splice(i,1);
            }
            this.less_source = null;
            this.changed = true;
        }

        this.renameLessRule = function(rule, new_selector, done) {
            var oldClass = rule.type == 'class' ? rule.class : null;
            rule.selector = new_selector;
            var i = this.crsa_rules.indexOf(rule);
            this.less_source = null;
            this.changed = true;
            this.genRegenerateAndSetCssSource(function() {
                var new_rule = _this.crsa_rules.length > i ? _this.crsa_rules[i] : null;
                var newClass = new_rule.type == 'class' ? new_rule.class : null;
                var changed = 0;
                $.each(_this.dom_ss, function(i, ss) {
                    if(ss.ownerNode.ownerDocument) {
                        var b = ss.ownerNode.ownerDocument.getElementsByTagName('body');
                        if(b && b.length > 0) {
                            var $body = $(b[0]);
                            if(oldClass && newClass) {
                                var $p = $body.parent();
                                var pgel = new pgQuery($p);
                                if(pgel) {
                                    var $changed = $p.find('.' + oldClass);
                                    changed += $changed.length;
                                    pgel.find('.' + oldClass).removeClass(oldClass).addClass(newClass);
                                }
                            }
                        }
                    }
                });
                if(done) done(new_rule, changed);
            });
        }

        this.setLessSource = function(s, done, skip_vars) {
            if(typeof skip_vars == 'undefined') skip_vars = false;
            this.less_source = s;
            this.regenerateAndSetCssSource(done, true, skip_vars);
        }

        this.getLessSource = function() {
            if(!this.less_source) this.less_source = this.getLessSourceForRules();
            return this.less_source;
        }

        this.getLessSourceForRules = function(rules) {
            var o = [];

            if(!rules) {
                rules = this.crsa_rules;
                o.push(getVariablesString());

             /*   $.each(this.less_variables, function(name, value) {
                    o.push(name + ": " + value + ";\n");
                });*/
                o.push("\n\n");
            }
            var last_media = null;
            var ident = '';

            $.each(rules, function(i, rd) {
                var media = rd.media ? rd.media : null;

                if(last_media !== media) {
                    if(last_media) {
                        o.push("}\n\n");
                    }
                    if(media) {
                        o.push("@media " + media + "\n{\n");
                        ident = '    ';
                    } else {
                        ident = '';
                    }
                }
                last_media = media;
                if(rd.edited_source) {
                    o.push(rd.edited_source);
                } else if(rd.raw) {
                    o.push($.trim(rd.raw) + "\n");
                }  else {
                    o.push(ident + rd.selector + "\n" + ident + "{\n");
                    $.each(rd.values, function(ii,s) {
                        o.push(ident + "    " + ii + ": " + s.value + ";\n");
                    });
                    o.push(ident + "}\n");
                }
                if(ident.length == 0) o.push("\n");
            });
            if(last_media) {
                o.push("}\n\n");
            }
            //o.push("\n");
            return o.join('');
        }

        this.getLessSourceHtmlForRule = function(rd) {
            var o = [];

            var media = rd.media ? rd.media : null;
            var ident = '';

            if(media) {
                o.push("<span class=\"cm-cp-media\">@media " + media + "</span>\n{\n");
                ident = '    ';
            }

            if(rd.raw) {
                o.push('<span class="cm-cp-raw">' + rd.raw + "</span>\n");
            } else if(rd.edited_source) {
                o.push('<span class="cm-cp-raw">' + rd.edited_source + "</span>\n");
            } else {
                o.push(ident + '<span class="cm-cp-sel">' + rd.selector + "</span>\n" + ident + "{\n");
                $.each(rd.values, function(ii,s) {
                    o.push(ident + "    <span class=\"cm-cp-prop\">" + ii + "</span>: <span class=\"cm-cp-val\">" + s.value + "</span>;\n");
                });
                o.push(ident + "}\n");
            }
            if(ident.length == 0) o.push("\n");

            if(media) {
                o.push("}\n\n");
            }
            return o.join('');
        }

        var convertFunction = function(func, params) {
            var args = params.split(',');

            var same = ['rgb', 'rgba', 'hsl', 'hsla', 'ceil', 'floor', 'percentage', 'round', 'abs', 'min', 'max', 'argb', 'hsv', 'hsva', 'hue', 'saturation', 'lightness', 'red', 'green', 'blue', 'alpha', 'saturate', 'desaturate', 'lighten', 'darken', 'mix', 'grayscale', 'contrast'];

            if(same.indexOf(func) >= 0) {
                return func + '(' + params + ')';
            }

            switch(func) {
                case 'color' :
                    return func + '(' + params.replace(/[\'\"]/g, '') + ')';

                case 'unit':
                    return args.length <= 1 ? 'unit(' + params + ')' : '(unit(' + args[0] + ') + ' + args[1] + ')';

                case 'escape':
                case 'unescape':
                    return (func == 'escape' ? 'quote' : 'unquote') + '(' + params + ')';

                case 'hsvhue':
                case 'hsvsaturation':
                case 'hsvlightness':
                    return func.replace('hsv', '') + '(' + params + ')';

                case 'fadein':
                    return 'fade-in(' + params + ')';

                case 'fadeout':
                    return 'fade-out(' + params + ')';

                case 'fade':
                    return 'rgba(' + params + ')';

                case 'spin':
                    return 'adjust-hue(' + params + ')';

                default:
                    //errors.push('Function <b>' + func + '</b> not supported in Sass.')
                    return func + '(' + params + ')';

            }
        }

        var findAndConvertFunction = function(val) {
            var i = 0;
            var len = val.length;
            var r = '';
            var orig = val;
            while(i < val.length) {
                var idx = val.search(/[a-z]+\(/i);
                if(idx < 0) return r + val;
                r = r + val.substr(0, idx);
                i = idx;
                var func = '';
                var params = '';
                var level = 0;
                var done = false;

                while(!done && i < len) {
                    var ch = val.charAt(i);
                    if(ch == '(') {
                        if(level > 0) {
                            params += ch;
                        }
                        level++;
                    } else if(ch == ')') {
                        level--;
                        if(level == 0) {
                            done = true;
                        } else {
                            params += ch;
                        }
                    } else {
                        if(level == 0) {
                            func += ch;
                        } else {
                            params += ch;
                        }
                    }
                    i++;
                }
                if(!done) {
                    //error
                    return orig;
                } else {
                    params = findAndConvertFunction(params);
                    r = r + convertFunction(func, params);
                }
                if(i < val.length) {
                    val = val.substr(i);
                    i = 0;
                }
            }
            return r;
        }


        var convertValueFromLessToSass = function(val) {

            val = val.replace(/@/g, '$');
            val = findAndConvertFunction(val);
            return val;
        }

        var getSassVariablesString = function() {
            var vars = crsaVariables.getVarsForCs(_this, true);
            var o = [];
            for(var n = 0; n < vars.length; n++) {
                var v = vars[n];
                o.push(v.name.replace('@', '$') + ': ' + (v.value) + ';\n');
               // o.push(v.name.replace('@', '$') + ': ' + convertValueFromLessToSass(v.value) + ';\n');
            }
            return o.join('');
        }

        this.getSassSourceForRules = function(rules) {
            var o = [];

            if(!rules) {
                rules = this.crsa_rules;
                o.push(getSassVariablesString());
                o.push("\n\n");
            }
            var last_media = null;
            var ident = '';

            $.each(rules, function(i, rd) {
                var media = rd.media ? rd.media : null;

                if(last_media !== media) {
                    if(last_media) {
                        o.push("}\n\n");
                    }
                    if(media) {
                        o.push("@media " + media + "\n{\n");
                        ident = '    ';
                    } else {
                        ident = '';
                    }
                }
                last_media = media;
                if(rd.raw) {
                    o.push($.trim(rd.raw) + "\n");
                } else {
                    o.push(ident + rd.selector + "\n" + ident + "{\n");
                    $.each(rd.values, function(ii,s) {
                        o.push(ident + "    " + ii + ": " + convertValueFromLessToSass(s.value) + ";\n");
                    });
                    o.push(ident + "}\n");
                }
                if(ident.length == 0) o.push("\n");
            });
            if(last_media) {
                o.push("}\n\n");
            }
            //o.push("\n");
            return o.join('');
        }

        this.getAllRules = function() {
            return this.crsa_rules;
        }

        this.getRuleByIndex = function(i) {
            return this.crsa_rules.length > i ? this.crsa_rules[i] : null;
        }

        var getVariablesString = function() {
            var vars = crsaVariables.getVarsForCs(_this, true);
            var o = [];
            for(var n = 0; n < vars.length; n++) {
                var v = vars[n];
                o.push(v.name + ': ' + v.value + ';\n');
            }
            return o.join('');
        }

        var getLessParser = function() {
            var env = new less.tree.parseEnv({relativeUrls: true});

            var root = crsaGetBaseForUrl(_this.url) + '/';

            var fileInfo = {
                currentDirectory: root,
                filename: _this.url,
                entryPath: root,
                rootpath: '',//root,
                rootFilename: _this.url,
                relativeUrls: true
            }

            env.currentFileInfo = fileInfo;
            return new(less.Parser)(env);
        }

        this.regenerateCssFromLessSource = function(done, process_rules, skip_vars) {
            if(typeof process_rules == 'undefined') process_rules = true;
            if(typeof skip_vars == 'undefined') skip_vars = false;

            var asyncDone = function() {
                setTimeout(function() {
                    if(done) done(_this.css_source);
                }, 1);
            }



            getLessParser().parse(this.getLessSource() + "\n" + (skip_vars ? '' : getVariablesString()), function (err, tree) {
                if (err) {
                    _this.less_error = err;
                    asyncDone();
                    return;// console.error(err)
                }
                _this.less_error = null;
                if(process_rules) {
                    _this.processLessTree(tree);
                }
                try {
                    _this.css_source = tree.toCSS();
                } catch(err) {
                    _this.less_error = err;
                    asyncDone();
                    return;
                }
                asyncDone();
            });
        }

        this.getCssSource = function(done) {
            if(this.css_source != null) {
                done(this.css_source);
            } else {
                this.genRegenerateCssFromSource(function(css) {
                    done(css);
                }, false);
            }
        }

        this.regenerateAndSetCssSource = function(done, process_rules, skip_vars) {
            if(typeof process_rules == 'undefined') process_rules = true;
            if(typeof skip_vars == 'undefined') skip_vars = false;
            this.regenerateCssFromLessSource(function() {
                if(!_this.less_error) {
                    _this.setAllCssText(_this.css_source);
                }
                if(done) done();
            }, process_rules, skip_vars);
        }

        this.setAllCssText = function(styles, rules) {
            //console.log(styles);
            if(!rules) {
                var cp = new CrsaSimpleCssParser();
                cp.parse(styles, _this);
                rules = cp.rules;

            }
            this.css_source = styles;
            for(var n = 0; n < this.dom_ss.length; n++) {
                var ss = this.dom_ss[n];
                this.setAllCssTextForPage(null, ss, styles, rules);
            }
        }

        this.setAllCssTextForPage = function(iframe, ss, source, rules) {
            //return;
            var ss = !ss ? this.findAttachmentFor(iframe) : ss;
            if(!ss) return;

            var css = ss;

            if(this.inline) {
                if(ss.ownerNode) {
                    var $style = $(ss.ownerNode);
                    $style.html(source);
                    var new_ss = $style.get(0).sheet;
                    var idx = this.dom_ss.indexOf(ss);
                    if(idx >= 0) {
                        this.dom_ss[idx] = new_ss;
                    } else {
                        this.dom_ss.push(new_ss);
                    }

                    var pgel = getElementPgNode($style);
                    if(pgel) {
                        pgel.html(source);
                    }
                }
            } else {

                if(!rules) {
                    var cp = new CrsaSimpleCssParser();
                    cp.parse(source, _this);
                    rules = cp.rules;
                }
                if (css.styleSheet) { // IE
                    try {
                        css.styleSheet.cssText = source;
                    } catch (e) {
                        throw new(Error)("Couldn't reassign styleSheet.cssText.");
                    }
                } else {
                    while (css.cssRules && css.cssRules.length > 0) {
                        if(css.removeRule) {
                            css.removeRule(0);
                        } else if(css.deleteRule) {
                            css.deleteRule(0);
                        }
                    }
                    for(var i = 0; i < rules.length; i++) {
                        var ruleSource = this.genGetSourceForRules([rules[i]]);
                        try {
                            css.insertRule(ruleSource, css.cssRules.length);
                        } catch(err) {
                            //console.log('Insert rule failed: ' + ruleSource);
                            //console.log(err);
                        }
                    }
                    /*
                    var wm = '@media (min-width:0px) {' + source + '}';
                    try {
                        css.insertRule(wm, 0);
                        var rule = css.cssRules[0];
                        var parsed = [];
                        for(var i = 0; i < rule.cssRules.length; i++) {
                            parsed.push(rule.cssRules[i].cssText);
                        }
                        if(css.removeRule) {
                            css.removeRule(0);
                        } else if(css.deleteRule) {
                            css.deleteRule(0);
                        }
                        for(var i = 0; i < parsed.length; i++) {
                            try {
                                css.insertRule(parsed[i], css.cssRules.length);
                            } catch(err) {
                                console.log('Insert rule failed: ' + parsed[i]);
                                console.log(err);
                            }
                        }
                    } catch(err) {
                        console.log(err);
                    }
                    */
                    /*
                     var list = styles.split('/*SPLIT* /');
                     var idx = 0;
                     $.each(list, function(i,r) {
                     r = r.replace("\n","");
                     if(r.length > 0) {
                     try {
                     css.insertRule(r, idx);
                     idx++;
                     } catch(err) {
                     console.log(err);
                     }
                     }
                     });
                     */
                }
            }
        }


        this.processLessTree = function(t) {
            this.less_tree = t;

            this.crsa_rules = [];
            this.less_variables = {};
            this.less_variables_string = '';

            crsaVariables.removeVarsForCs(this);

            for(var ri = 0; ri < t.rules.length; ri++) {
                var rule = t.rules[ri];

                this.processTreeRule(rule, this.crsa_rules);
            }
        }

        this.processTreeRule = function(rule, crsa_rules, skip_vars) {
            //console.log(rule);

            if(typeof skip_vars == 'undefined') skip_vars = false;
            var strs = [];
            var output = {
                add: function(chunk, fileInfo, index) {
                    strs.push(chunk);
                },
                isEmpty: function () {
                    return strs.length === 0;
                }
            };
            var env = {compress : false, tabLevel: 0};

            try {
                if(rule.hasOwnProperty('importedFilename')) {
                    //debugger;
                    rule.crsaSource = '@import "' + rule.importedFilename.replace(rule.currentFileInfo.currentDirectory,'') + '";';

                } else if(rule.hasOwnProperty('variable') && rule.variable) {
                    if(skip_vars) return null;

                    var name = $.trim(rule.name);
                    rule.value.genCSS({compress: false}, output);
                    var value = strs.join('');

                    this.less_variables[name] = value;

                    this.less_variables_string += name + ":" + value + ";";

                    crsaVariables.add(name, value, this);
                    return null;
                }
                if(rule.hasOwnProperty('features') && rule.rules) {
                    strs = [];
                    rule.features.genCSS(env, output);
                    var media = $.trim(strs.join(''));

                    //  console.log(media);

                    for(var ri = 0; ri < rule.rules.length; ri++) {
                        var subrule = rule.rules[ri];
                        if(subrule.rules) {
                            for(var rri = 0; rri < subrule.rules.length; rri++) {
                                var subsubrule = subrule.rules[rri];
                                var r = this.processTreeRule(subsubrule, crsa_rules, skip_vars);
                                if(r) r.media = media;
                            }
                        }
                    }
                    return null;
                }

                if(rule.selectors && rule.rules)  {

                    /*     for(var i = 0; i < rule.selectors.length; i++) {
                     var path = rule.selectors[i];
                     env.firstSelector = true;
                     path.genCSS(env, output);
                     env.firstSelector = false;
                     }*/
                    var context = [];
                    var paths = [];
                    rule.joinSelectors(paths, context, rule.selectors);
                    rule.paths = paths;

                    //  env.compress = true;

                    for(var i = 0; i < rule.paths.length; i++) {
                        var path = rule.paths[i];
                        env.firstSelector = true;
                        for(var j = 0; j < path.length; j++) {
                            path[j].genCSS(env, output);
                            env.firstSelector = false;
                        }
                        var tabSetStr = env.compress ? '' : Array(env.tabLevel).join("  ");
                        if (i + 1 < rule.paths.length) {
                            output.add(env.compress ? ',' : (',\n' + tabSetStr));
                        }
                    }

                    var selector = $.trim(strs.join(''));//.replace("\n","");
                    //  console.log(selector);

                    if(selector.length == 0) return null;

                    var values = {};
                    var raw = null;
                    var multiple_values = false;

                    for(var i = 0; i < rule.rules.length; i++) {
                        strs = [];
                        var ruleLine = rule.rules[i];
                        if(!ruleLine.name || ruleLine.crsaType != 'Rule') {
                            raw = rule.crsaSource;
                            values = null;
                            multiple_values = true;
                            break;
                        }
                        var name = ruleLine.name;
                        var value = null;
                        if(ruleLine.value) {
                            if(ruleLine.value.crsaSource) {
                                value = ruleLine.value.crsaSource;
                            } else {
                                ruleLine.value.genCSS(env, output);
                                value = strs.join('');
                            }
                        }
                        if(ruleLine.important != "" && !value.match(/\!important/i)) {
                            value = value + " !important";
                        }
                        if(values.hasOwnProperty(name)) {
                            raw = rule.crsaSource;
                            multiple_values = true;
                            values = null;
                            break;
                        }

                        values[name] = {value: value, less_rule_line: ruleLine, important: ruleLine.important != ""};
                    }
                    r = {values : values, selector : selector, crsa_stylesheet: this, raw: raw, multiple_values: multiple_values};

                } else if(rule.name && rule.rules) {
                    strs = [];

                    rule.genCSS(env, output);
                    var str = strs.join('');
                    //console.log(str);
                } else if(rule.crsaSource) {
                    r = {raw: rule.crsaSource, crsa_stylesheet: this, less_type: rule.__proto__.type};
                }
                if(r) {
                    r.index = crsa_rules.length;
                    crsa_rules.push(r);
                    setRuleInfo(r);
                    return r;
                }
                return null;
            }
            catch(err) {
                if(rule.crsaSource) {
                    r = {raw: rule.crsaSource, crsa_stylesheet: this};
                    setRuleInfo(r);
                    r.index = crsa_rules.length;
                    crsa_rules.push(r);
                    return r;
                }
                console.log(err);
                return null;
            }
        }

        var getNormalizedSelectorForCssRule = function(css_rule) {
            if(!css_rule.selectorText) return null;
            if(!css_rule.crsaNormalizedSelector) {
                css_rule.crsaNormalizedSelector = normalizeSelector(css_rule.selectorText);
            }
            return css_rule.crsaNormalizedSelector;
        }

        var getNormalizedSelectorForCrsaRule = function(rule) {
            if(!rule.selector) return null;
            if(!rule.crsaNormalizedSelector) {
                rule.crsaNormalizedSelector = normalizeSelector(rule.selector);
            }
            return rule.crsaNormalizedSelector;
        }

        this.getSelector = function(rule) {
            return getNormalizedSelectorForCrsaRule(rule);
        }

        this.findCssRules = function(ss, sel) {
            sel = normalizeSelector(sel);
            var list = [];
            if(ss.cssRules) {
                var searchList = ss.cssRules;
                if(searchList.length == 1 && searchList[0].media) {
                    searchList = searchList[0].cssRules || [];
                }
                $.each(searchList, function(i,r) {
                    if(getNormalizedSelectorForCssRule(r) == sel) {
                        list.push(r);
                    }
                })
            }
            return list;
        }

        this.findLessRules = function(sel) {
            sel = normalizeSelector(sel);
            var list = [];
            $.each(this.crsa_rules, function(i,r) {
                if(r.selector && getNormalizedSelectorForCrsaRule(r) == sel) {
                    list.push(r);
                }
            });
            return list;
        }

        this.regenerateLessRule = function(rule, done) {
            this.lessRuleValueChanged(rule, null, null, done);
        }

        var setValue = function(rule, name, value) {
            if(value == null) {
                if(name in rule.values)  delete rule.values[name];
            } else {
                if(!(name in rule.values)) {
                    rule.values[name] = {};
                }
                rule.values[name].value = value;
            }
        }

        this.lessRuleValueChanged = function(rule, name, value, done, no_refresh) {
            if(name) {
                if(name == 'media') {
                    rule.media = value;
                } else {
                    setValue(rule, name, value);
                }
            }

            this.css_source = null;
            this.less_source = null;
            this.changed = true;

            var asyncDone = function() {
                if(done) {
                    setTimeout(done, 1);
                }
            }

            if(no_refresh) {
                asyncDone();
                return;
            }

            var lessStr = this.getLessSourceForRules([rule]);

            getLessParser().parse(lessStr + "\n" + getVariablesString(), function (err, tree) {
                if (err) {
                    _this.less_error = err;
                    asyncDone();
                    return;
                }
                _this.less_error = null;

                var rules = [];
                for(var ri = 0; ri < tree.rules.length; ri++) {
                    var r = tree.rules[ri];
                    _this.processTreeRule(r, rules, true);
                }
                var css;
                try {
                    css = tree.toCSS();
                } catch(err) {
                    _this.less_error = err;
                    asyncDone();
                    return;
                }

                _this.updateCssRulesInStylesheets(rule, rules, css, asyncDone);
            });
        }

        this.cssRuleValueChanged = function(rule, name, value, done, no_refresh) {
            if(name) {
                if(name == 'media') {
                    rule.media = value;
                } else {
                    setValue(rule, name, value);
                }
            }

            this.css_source = null;
            this.changed = true;

            var asyncDone = function() {
                if(done) {
                    setTimeout(done, 1);
                }
            }

            if(no_refresh) {
                asyncDone();
                return;
            }

            var css = this.genGetSourceForRules([rule]);

            /*
            var scss = css;
            console.log('SASS TIME!');

            sassJS.compile(scss, function(result) {
                console.log(result);
            });
            */

            _this.updateCssRulesInStylesheets(rule, [rule], css, asyncDone);
        }

        this.updateCssRulesInStylesheets = function(rule, rules, css, done) {
            var apply_all = false;

            if(rules.length != 1) {
                apply_all = true;
            } else if(_this.inline) {
                apply_all = true;
            } else if(!rules[0].selector) {
                apply_all = true;
            } else if(rules[0].media) {
                apply_all = true;
            } else if(normalizeSelector(rules[0].selector) != normalizeSelector(rule.selector)) {
                apply_all = true;
            } else {

                var m = css.match(/\{([\s\S]*)\}/);
                if(!m) {
                    apply_all = true;
                } else {
                    var list = _this.genFindRules(rule.selector);
                    if(list.length > 1) {
                        apply_all = true;
                    }
                }
            }

            if(!apply_all) {
                for(var i = 0; i < _this.dom_ss.length; i++) {
                    var ss = _this.dom_ss[i];
                    var css_rules = _this.findCssRules(ss, rule.selector);
                    if(css_rules.length == 1) {
                        css_rules[0].style.cssText = m[1].replace("\n","");
                        console.log('single rule changed');
                    } else {
                        apply_all = true;
                        break;
                    }
                }
            }

            if(apply_all) {
                console.log('changing whole css');
                _this.genRegenerateAndSetCssSource(function() {
                    done();
                }, false); //dont regenerate crsa rules
            } else {
                done();
            }
        }
    }



    window.CrsaPageStyles = function(iframe) {
        this.$iframe = $(iframe);
        this.stylesheets = [];
        this.default_ignore = [/fonts\.googl/i];

        var active_rules = null;
        var _this = this;

        this.destroy = function() {
            this.$iframe = null;
            this.stylesheets = [];
        }

       // var r = this.match(/(^|\/)bootstrap\.(css|less)/i);

        var getIgnoreFiles = function() {
            var cp = getCrsaPageForIframe(_this.$iframe);
            var r = _this.default_ignore;
            $.each(cp.frameworks, function(i,f) {
                r = r.concat(f.ignore_css_files);
            });
            return r;
        }

        this.attachTo = function(cs, sheet, done) {
            this.stylesheets.push(cs);
            cs.attachTo(this.$iframe.get(0), sheet, done);
        }

        this.detachFrom = function(cs) {
            cs.detachFrom(this.$iframe.get(0));
            var idx = this.stylesheets.indexOf(cs);
            if(idx >= 0) this.stylesheets.splice(idx, 1);
        }

        this.removeAllInlineSheets = function() {
            for(var i = 0; i < this.stylesheets.length; i++) {
                var cs = this.stylesheets[i];
                if(cs.inline) {
                    this.stylesheets.splice(i,1);
                    i--;
                    var idx = crsaStylesheets.indexOf(cs);
                    if(idx >= 0) crsaStylesheets.splice(idx, 1);
                    cs.unload();
                }
            }
        }

        this.removeAllExclusiveSheets = function() {
            for(var i = 0; i < this.stylesheets.length; i++) {
                var cs = this.stylesheets[i];
                cs.cleanDomSs();
                if(cs.dom_ss.length == 1) {
                    this.stylesheets.splice(i,1);
                    i--;
                    var idx = crsaStylesheets.indexOf(cs);
                    if(idx >= 0) crsaStylesheets.splice(idx, 1);
                    cs.unload();
                }
            }
        }

        this.loadAllStylesheets = function(done, include_dynamic) {
            var count = 0;
            var done_timeout = null;
            var doc = this.$iframe.get(0).contentDocument || this.$iframe.get(0).contentWindow.document;

            for(var i=0; i<doc.styleSheets.length; i++) {
                var sheet = doc.styleSheets[i];
                var ignore = false;

                if(sheet.ownerNode) {
                    if(sheet.ownerNode.id == 'crsa-inline-styles') {
                        continue;
                    }
                    if(!include_dynamic && !getElementPgId($(sheet.ownerNode))) {
                        continue;
                    }
                }
                var ignoreFiles = getIgnoreFiles();
                for(var n = 0; n < ignoreFiles.length; n++) {
                    if(sheet.href && sheet.href.match(ignoreFiles[n])) {
                        ignore = true;
                        break;
                    }
                }
                //if(ignore) continue;


                if(sheet.href) {
                    if(sheet.href.indexOf('data:') === 0) continue;

                    var cslist = findCrsaStylesheetForUrl(service.getOriginalUrl(sheet.href));
                    var cs = cslist.length > 0 ? cslist[0] : null;
                    if(cs) {
                        console.log('PS: ss found, reusing ' + cs.name);
                        this.attachTo(cs, sheet);
                    } else {
                        console.log('PS: loading ' + sheet.href);
                        count++;
                        cs = new CrsaStylesheet();
                        this.attachTo(cs, sheet);
                        crsaStylesheets.push(cs);

                        cs.ignore = ignore;

                        //cs.ignore = true;

                        cs.load(sheet.href, function(cs) {
                            count--;
                            console.log('done ' + cs.url + ' ' + count);
                            if(count == 0 && done) {
                                done();
                                count--;
                            }
                        });
                    }
                } else {
                    //inline
                    console.log('loading inline css');
                    count++;
                    cs = new CrsaStylesheet();
                    this.attachTo(cs, sheet);
                    crsaStylesheets.push(cs);
                    cs.loadInline(sheet, function() {
                        count--;
                        if(count == 0 && done) {
                            done();
                            count--;
                        }
                    });
                }
            }
            if(count == 0 && done) done();
        }

        this.getAllActiveRules = function(skip_list) {
            var iframe = this.$iframe.get(0);
            if(active_rules == null || true) {
                active_rules = [];
                for(var i = 0; i < this.stylesheets.length; i++) {
                    var cs = this.stylesheets[i];
                    if(skip_list && skip_list.indexOf(cs) >= 0) continue;
                    if(cs.isEnabledForPage(iframe)) {
                        active_rules = active_rules.concat(cs.getAllRules());
                    }
                }
            }
            return active_rules;
        }

        this.getAllCrsaStylesheets = function() {
            return this.stylesheets;
        }

        this.reorder = function(crsa_styles_list, done) {
            if(crsa_styles_list.length > 0) {
                var c = 0;
                for(var n = 0; n < crsa_styles_list.length; n++) {
                    var cs = crsa_styles_list[n];
                    if(cs.inline) continue;
                    cs.detachFrom(iframe);
                    c++;
                    cs.attachTo(iframe, null, function() {
                        c--;
                        if(c == 0) {
                            this.stylesheets = crsa_styles_list;
                            if(done) done();
                        }
                    });
                }
            } else {
                if(done) done();
            }
        }

        this.reorderRules = function(cs_list, rules, done) {
            var c = 0;
            $.each(cs_list, function(i, cs) {
                var list = [];
                $.each(rules, function(j, r) {
                    if(r.crsa_stylesheet == cs) list.push(r);
                });
                cs.crsa_rules = list;
                cs.less_source = null;
                cs.changed = true;
                c++;

                cs.genRegenerateAndSetCssSource(function() {
                    c--;
                    if(c == 0 && done) done();
                });
            });
            if(!cs_list || cs_list.length == 0 && done) done();
        }
    }



    var crsaStylesheets = [];
    var crsaVariables = new CrsaVariables();

    window.findCrsaStylesheetForUrl = function(url, ignore_ext) {

        //broken
        var removeExt = function(url) {
            if(!url) return url;
            var a = url.split('.');
            if(a.length > 1) a.pop();
            return a.join('.');
        }

        ignore_ext = false;

        if(ignore_ext) url = removeExt(url);

        var r = [];
        for(var i = 0; i < crsaStylesheets.length; i++) {
            if(!crsaStylesheets[i].url) continue;
            var csurl = ignore_ext ? removeExt(crsaStylesheets[i].url) : crsaStylesheets[i].url;
            if(csurl == url) r.push(crsaStylesheets[i]);
        }
        return r;
    }

    window.getCrsaPageStylesForPage = function($iframe) {
        return $iframe.data('crsa-page-styles');
    }



    $.fn.crsacss = function( method ) {

        //var opts = $.extend( {}, $.fn.hilight.defaults, options );
        if ( methods[method] ) {
            return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.crsacss' );
        }
    };

    var $body = $('body');

    var less_tree = null;
    var crsa_rules = [];

    //////////////////////////////////////////////////////
    //sws//
    //var less_parser  = new(less.Parser);

    //sws//
    //////////////////////////////////////////////////////


    var less_variables = {};
    var less_variables_string = '';
    var less_source = null;
    var $iframes = [];
    var opts;
    var css_source = null;
    var rules_div = null;

    var methods = {
        init : function( options ) {
            opts = $.extend( {}, $.fn.crsacss.defaults, options );

            $('body').on('crsa-page-added', function(event, iframe) {

                $iframes = $('iframe.content-iframe');

               // initDocumentStylesheet($iframes);
            });

            $('div.canvas').on('crsa-page-closed-removed', function(e, crsaPage) {
                $iframes = $('iframe.content-iframe');
            });

            return this.each(function(i,e){

            });
        },
        addStylesheetFromUrl : function(url, done) {
            var cs = findCrsaStylesheetForUrl(url);
            if(cs.length > 0) {
                if(done) done(cs[0]);
                return;
            }
            cs = new CrsaStylesheet();
            cs.load(url, function() {
                crsaStylesheets.push(cs);
                if(done) done(cs);
            });
        },
        getAllCrsaStylesheets : function() {
            return crsaStylesheets;
        },
        overrideDocumentStylesheet : function($iframes) {
            initDocumentStylesheet($iframes, function() {
                if(!css_source) {
                    regenerateCssFromLessSource();
                } else {
                    methods.setAllCssText(css_source);
                }
            });
        },
        loadLessStyles : function(iframe, done, include_dynamic) {
            var $iframe = $(iframe);
            var oldps = getCrsaPageStylesForPage($iframe);
            if(oldps) {
                oldps.removeAllInlineSheets();
                oldps.destroy();
            }
            var ps = new CrsaPageStyles(iframe);
            $iframe.data('crsa-page-styles', ps);

            ps.loadAllStylesheets(function() {
                console.log('all stylesheets loaded');
                if(done) done();
            }, include_dynamic);
        },
        setLessSource : function(s, done) {
            less_source = s;
            regenerateCssFromLessSource(done);
        },
        processLessTree : function(t) {
            less_tree = t;

            crsa_rules = [];
            less_variables = {};
            less_variables_string = '';

            for(var ri = 0; ri < t.rules.length; ri++) {
                var rule = t.rules[ri];

                methods.processTreeRule(rule, crsa_rules);
             //   console.log(values);
            }
        },
        processTreeRule : function(rule, crsa_rules, skip_vars) {
            if(typeof skip_vars == 'undefined') skip_vars = false;
            var strs = [];
            var output = {
                add: function(chunk, fileInfo, index) {
                    strs.push(chunk);
                },
                isEmpty: function () {
                    return strs.length === 0;
                }
            };
            var env = {compress : false, tabLevel: 0};

            try {
                if(rule.hasOwnProperty('variable') && rule.variable && !skip_vars) {
                    var name = $.trim(rule.name);
                    rule.value.genCSS({compress: false}, output);
                    var value = strs.join('');

                    less_variables[name] = value;

                    less_variables_string += name + ":" + value + ";";
                    return null;
                }
                if(rule.hasOwnProperty('features') && rule.rules) {
                    strs = [];
                    rule.features.genCSS(env, output);
                    var media = $.trim(strs.join(''));

                  //  console.log(media);

                    for(var ri = 0; ri < rule.rules.length; ri++) {
                        var subrule = rule.rules[ri];
                        if(subrule.rules) {
                            for(var rri = 0; rri < subrule.rules.length; rri++) {
                                var subsubrule = subrule.rules[rri];
                                var r = methods.processTreeRule(subsubrule);
                                if(r) r.media = media;
                            }
                        }
                    }
                    return null;
                }
                if(!rule.rules)  return null;

                if(rule.selectors)  {

               /*     for(var i = 0; i < rule.selectors.length; i++) {
                        var path = rule.selectors[i];
                        env.firstSelector = true;
                        path.genCSS(env, output);
                        env.firstSelector = false;
                    }*/
                    var context = [];
                    var paths = [];
                    rule.joinSelectors(paths, context, rule.selectors);
                    rule.paths = paths;

                  //  env.compress = true;

                    for(var i = 0; i < rule.paths.length; i++) {
                        var path = rule.paths[i];
                        env.firstSelector = true;
                        for(var j = 0; j < path.length; j++) {
                            path[j].genCSS(env, output);
                            env.firstSelector = false;
                        }
                        var tabSetStr = env.compress ? '' : Array(env.tabLevel).join("  ");
                        if (i + 1 < rule.paths.length) {
                            output.add(env.compress ? ',' : (',\n' + tabSetStr));
                        }
                    }

                    var selector = $.trim(strs.join(''));//.replace("\n","");
                    //  console.log(selector);

                    if(selector.length == 0) return null;

                    var values = {};

                    for(var i = 0; i < rule.rules.length; i++) {
                        strs = [];
                        var ruleLine = rule.rules[i];
                        if(!ruleLine.name) continue;
                        var name = ruleLine.name;
                        var value = null;
                        if(ruleLine.value) {
                            ruleLine.value.genCSS(env, output);
                            value = strs.join('');
                        }
                        values[name] = value;
                    }
                    r = {values : values, selector : selector};
                } else if(rule.name && rule.rules) {
                    strs = [];

                    rule.genCSS(env, output);
                    var str = strs.join('');
                    console.log(str);
                }
                if(r) {
                    crsa_rules.push(r);
                    setRuleInfo(r);
                    return r;
                }
                return null;
            }
            catch(err) {
                if(rule.crsaSource) {
                    r = {raw: rule.crsaSource};
                    setRuleInfo(r);
                    crsa_rules.push(r);
                    return r;
                }
                console.log(err);
                return null;
            }


        },
        getLessVariables : function() {
            return less_variables;
        },
        getLessRuleValues : function(rule) {
            //if(typeof rule == 'string') rule = methods.findLessRule(rule);
            return rule.values;
        },
        getAllLessRules : function() {
            return crsa_rules;
        },
        lessVariableChanged : function(name, value) {
            var nv = name + ":" + value + ";";
            if(less_variables_string.indexOf(name + ":") < 0) {
                less_variables_string += nv;
            } else {
                var re = new RegExp(escapeRegExp(name) + "\s*:\s*" + "[^;]*;","ig");
                less_variables_string = less_variables_string.replace(re, nv);
            }
            less_variables[name] = value;
            css_source = null;
            regenerateCssFromLessSource();
        },
        lessRuleValueChanged : function(rule, name, value, done, no_refresh) {

            var cs = rule.crsa_stylesheet;
            cs.lessRuleValueChanged(rule, name, value, done, no_refresh);
            return;


          //  if(typeof rule == 'string') rule = methods.findLessRule(rule);
            if(rule) {
                if(name == 'media') {
                    rule.media = value;
                } else {
                    rule.values[name] = value;
                }

                var lessStr = methods.getLessSourceForRules([rule]);

                css_source = null;

                less_parser.parse(lessStr + "\n" + less_variables_string, function (err, tree) {
                    if (err) { return console.error(err) }
                    var css = tree.toCSS();
                    var m = css.match(/\{([\s\S]*)\}/);
                    if(m) {
                        methods.setRuleText(rule.selector, m[1].replace("\n",""));
                    }
                });
                less_source = null;
            }
        },
        getLessSource : function() {
            if(!less_source) less_source = methods.getLessSourceForRules();
            return less_source;
        },
        getLessSourceForRules : function(rules) {
            var o = [];

            if(!rules) {
                rules = crsa_rules;
                $.each(less_variables, function(name, value) {
                    o.push(name + ": " + value + ";\n");
                });
                o.push("\n");
            }
            var last_media = null;
            var ident = '';

            $.each(rules, function(i, rd) {
                var media = rd.media ? rd.media : null;

                if(last_media !== media) {
                    if(last_media) {
                        o.push("}\n\n");
                    }
                    if(media) {
                        o.push("@media " + media + "\n{\n");
                        ident = '    ';
                    } else {
                        ident = '';
                    }
                }
                last_media = media;
                if(rd.raw) {
                    o.push(rd.raw);
                } else if(rd.edited_source) {
                    o.push(rd.edited_source);
                } else {
                    o.push(ident + rd.selector + "\n" + ident + "{\n");
                    $.each(rd.values, function(ii,s) {
                        o.push(ident + "    " + ii + ": " + s + ";\n");
                    });
                    o.push(ident + "}\n");
                }
                if(ident.length == 0) o.push("\n");
            });
            if(last_media) {
                o.push("}\n\n");
            }
            //o.push("\n");
            return o.join('');
        },
        lessTreeToCss : function() {
            var css = less_tree.toCSS();
            methods.setAllCssText(css);
        },
        findLessRules : function(selector) {
            var list = [];
            $.each(crsa_rules, function(i,r) {
                if(r.selector == selector) list.push(r);
            });
            return list;
        },
        addLessRule : function(selector, values, done) {
            if(!values) values = {};
            var r = {selector : selector, values : values};
            setRuleInfo(r);

            less_source = methods.genGetSource() + "\n" + methods.genGetSourceForRules([r]);
            regenerateCssFromLessSource(function() {
                if(done) done(crsa_rules[crsa_rules.length-1]);
            });
            return r;
        },
        removeLessRule : function(rule, done) {
            var i = crsa_rules.indexOf(rule);
            if(i >= 0) {
                crsa_rules.splice(i,1);
            }
            less_source = null;
            regenerateCssFromLessSource(done);
        },
        renameLessRule : function(rule, new_selector, done) {
            rule.crsa_stylesheet.renameLessRule(rule, new_selector, done);
        },
        reorderLessRules : function(list) {
            crsa_rules = list;
            less_source = null;
            regenerateCssFromLessSource();
        },
        addRule : function(rule) {
            var $rules = $();
            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');
                ss.insertRule( rule, ss.cssRules ? ss.cssRules.length : 0 );
                $rules = $rules.add(ss.cssRules[ ss.cssRules.length - 1 ]);
            });
            return $rules;
        },
        css : function($rules, prop, value) {
            $rules.each(function(i,e) {
                $(e).css(prop, value);
            });
            return this;
        },
        find : function(sel) {
            var rules = [];
            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');
                var a = filterRules($(ss.cssRules), sel);
                $.each(a, function(i,e) {
                    rules.push(e);
                });
            });
            var r = $(rules);
            return r;
        },
        findAll : function(onlyClasses) {
            if(typeof onlyClasses == 'undefined') onlyClasses = false;

            var rules = [];

            $.each(crsa_rules, function(key, rule) {
                if(onlyClasses && rule.type !== 'class') {
                } else {
                    rules.push(rule);
                }
            });
            return rules;

            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');
                var a = filterRules($(ss.cssRules), null);
                $.each(a, function(i,e) {
                    if(onlyClasses && !getClassFromSelector(e.selectorText)) {

                    } else {
                        rules.push(e);
                    }
                });
            });
            var r = $(rules);
            return r;
        },
        setRuleText : function(selector, text) {
            var $rules = typeof selector == 'string' ? methods.find.call(this, selector) : selector;
            if($rules.length == 0) $rules = methods.addRule(selector + " {}");
            $.each($rules, function(i,r) {
                r.style.cssText = text;
            });
            return this;
        },
        replaceRule : function(rule, new_text_with_selector) {
            var ss = rule.parentStyleSheet;
            var i = ss.cssRules.indexOf(rule);
            if(i < 0) i = ss.cssRules.length;
            ss.insertRule(new_text_with_selector, i);
        },
        replaceAllRules : function(rules) {
            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');
                var all = [];
                $.each(ss.cssRules, function(i,r) {
                    all.push(r);
                });
                $.each(all, function(i, r) {
                    if(ss.removeRule) {
                        ss.removeRule(0);
                    } else if(ss.deleteRule) {
                        ss.deleteRule(0);
                    }
                });
                $.each(rules, function(i,r) {
                    ss.insertRule(r.cssText, i);
                });
                //ss.cssRules = rules;
            });
        },
        setAllCssText : function(styles) {
            css_source = styles;
            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');

                var css = ss;
                var doc = getIframeDocument(e);

                if (css.styleSheet) { // IE
                    try {
                        css.styleSheet.cssText = styles;
                    } catch (e) {
                        throw new(Error)("Couldn't reassign styleSheet.cssText.");
                    }
                } else {
                    while (css.cssRules && css.cssRules.length > 0) {
                        if(css.removeRule) {
                            css.removeRule(0);
                        } else if(css.deleteRule) {
                            css.deleteRule(0);
                        }
                    }
                   // console.log(styles);
                    var wm = '@media (min-width:0px) {' + styles + '}';
                    try {
                        css.insertRule(wm, 0);
                    } catch(err) {
                        console.log(err);
                    }
                    /*
                    var list = styles.split('/*SPLIT* /');
                    var idx = 0;
                    $.each(list, function(i,r) {
                        r = r.replace("\n","");
                        if(r.length > 0) {
                            try {
                                css.insertRule(r, idx);
                                idx++;
                            } catch(err) {
                                console.log(err);
                            }
                        }
                    });
                    */
                }
            });
        },
        renameRule : function($rule, new_selector) {
            $rule.each(function(i,r) {
                r.selectorText = new_selector;
            });
        },
        getCss : function($rules, prop) {
            if($rules.length == 0) return null;
            var r = $rules[0];
            var s = r.style;
            if(s[prop]) return s[prop];
            return null;
        },
        getAllStyles : function($rules) {
            if(typeof $rules == 'string') $rules = this.crsacss('find', $rules);
            if($rules.length == 0) return null;
            var r = $rules[0];
            return r.style;
        },
        getCssAsText : function() {
            var r = '';
            $iframes.each(function(i,e){
                var $frame = $(e);
                var ss = $frame.data('crsa-css-ss');
                $.each(ss.cssRules, function(i,rule) {
                    r = r + rule.cssText + "\n\n";
                });
            });
            return r;
        },
        getClassesForElement : function($el) {
            var el = $el.get(0);
            if(typeof el.className !== 'string') return [];

            var list = el.className.split(/\s+/);
            var r = [];
            for(var n = 0; n < list.length; n++) {
                if(list[n].indexOf('crsa-') != 0) {
                    r.push('.' + list[n]);
                }
            }
            return r;
        },
        getRulesForElement : function($el, add_classes, return_selectors) {
            var list = [];
            var selectors = [];
            var node = $el.get(0);
            if(node.ownerDocument.defaultView && node.ownerDocument.defaultView.getMatchedCSSRules) {
                var rules = node.ownerDocument.defaultView.getMatchedCSSRules(node, '');
                var dir = {};
                if(rules) {
                    var i = rules.length;
                    while (i--) {
                        dir[normalizeSelector(rules[i].selectorText)] = true;
                    }
                    for(var i = 0; i < crsaStylesheets.length; i++) {
                        var cs = crsaStylesheets[i];
                        if(cs.ignore) continue;
                        $.each(cs.getAllRules(), function(i,r) {
                            var sel;
                            if(r.selector && (sel = cs.getSelector(r)) in dir) {
                                list.push(r);
                                if(selectors.indexOf(sel) < 0) selectors.push(sel);
                            }
                        });
                    }
                }
                if(add_classes) {
                    var cls = methods.getClassesForElement( $el);
                    for(var i = 0; i < cls.length; i++) {
                        var c = normalizeSelector(cls[i]);
                        if(selectors.indexOf(c) < 0) selectors.push(c);
                    }
                }
                return return_selectors ? selectors : list;
            } else {
                for(var i = 0; i < crsaStylesheets.length; i++) {
                    var cs = crsaStylesheets[i];
                    $.each(cs.getAllRules(), function(i,r) {
                        try {
                            if(r.selector && $el.is(r.selector)) {
                                var sel = normalizeSelector(r.selector);
                                list.push(r);
                                if(selectors.indexOf(sel) < 0) selectors.push(sel);
                            }
                        }
                        catch(err) {}
                    });
                    if(add_classes) {
                        var cls = methods.getClassesForElement( $el);
                        for(var i = 0; i < cls.length; i++) {
                            var c = normalizeSelector('.' + cls[i]);
                            var found = false;
                            for(j = 0; j < list.length; j++) {
                                var r = list[j];
                                if(typeof r == 'object' && r.selector) {
                                    if(c == normalizeSelector(r.selector)) {
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if(!found) {
                                selectors.push(c);
                            }
                        }
                    }
                }
            }
            return return_selectors ? selectors : list;
        },
        showVariables : function() {

            var showAddVariableBox = function($el, cs) {
                var eid = getUniqueId();
                if($el.data('popover-active')) {
                    $el.popover('destroy');
                    $el.data('popover-active', null);
                    return;
                }

                var ensureRemove = function($e) {
                    setTimeout(function() {
                        $e.closest('.popover').remove();
                    }, 750);
                }

                var pop = $el.popover({
                    html: true,
                    placement: 'right',
                    trigger: 'manual',
                    title: 'Add new variable',
                    container: 'body',
                    content: '<form id="' + eid + '"><form><input class="form-control" placeholder="var_name" style="margin-bottom:8px;"/><button class="ok btn">Create</button><button class="closeit btn btn-link">Cancel</button></form>'
                })
                    .on('shown.bs.popover', function() {
                        var $d = $('#' + eid);
                        var $i = $d.find('input').focus();
                        var $b = $d.find('button.ok');
                        var $bc = $d.find('button.closeit');

                        var doAdd = function() {
                            var val = $.trim($i.val());
                            if(val.length > 0) {
                                if(val.substr(0,1) != '@') val = '@' + val;
                                var ev = crsaVariables.findByName(val, cs);

                                if(ev) {
                                    showAlert('Variable ' + val + ' is already defined.', "Can't add variable");
                                    return;
                                } else {

                                    getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Add variable " + val, false, cs);
                                    var type = cs.genGetType();
                                    crsaVariables.add(val, '', cs);
                                    cs.genForgetCachedSource();
                                    cs.genRegenerateAndSetCssSource(function() {
                                        $('body').trigger('crsa-stylesheets-changed');
                                        //updateList();
                                        $('body').trigger('crsa-variables-changed', {list: [cs]});
                                        var nt = cs.genGetType();
                                        if(type != nt && nt != 'css') {
                                            showAlert('To work with variables ' + cs.name + ' is now using <b>' + nt.toUpperCase() + '</b> parser. .less file will be saved alongside .css version. Use <b>' + val + '</b> in CSS rules instead of hard-coded values.', 'Notice');
                                        }
                                    });

                                }
                            }
                            $el.popover('hide');
                            ensureRemove($d);
                        }

                        $b.on('click', function(e) {
                            e.preventDefault();
                            doAdd();
                        });

                        $d.on('submit', function(e) {
                            e.preventDefault();
                            doAdd();
                        })

                        $bc.on('click', function(e) {
                            $el.popover('hide');
                            e.preventDefault();
                            ensureRemove($d);
                        });
                    })
                    .on('hidden.bs.popover', function() {
                        setTimeout(function() {
                            $el.popover('destroy').data('popover-active', null);
                        },10);
                    });
                $el.popover('show').data('popover-active', true);
            }

            var $dest = $("#crsa-vars");


            var add_less = true;

            var list = [];

            var updateList = function() {
                $dest.find('.crsa-input-color-picker').spectrum('destroy');

                pgRemoveMultiselects($dest);

                $dest.html('');

                $.each(crsaStylesheets, function(i, cs) {
                    if(cs.inline || cs.ignore) return true;
                    var $h = $('<h3/>', {class: 'crsa-cm-cs'}).html(cs.name).appendTo($dest);
                    var $a = $('<a/>', {class: 'cm-varlist-add', href:"#"}).html('+ Add var').appendTo($h);
                    $a.on('click', function(e) {
                        e.preventDefault();
                        //if(cs.genGetError()) {
                       //     showAlert('This stylesheet has syntax errors. Please fix these errors before adding variables. Go to CSS tab to see error info and select Page -&gt; Edit code to fix them.');
                        //} else {
                            showAddVariableBox($a, cs);
                        //}
                    });

                    var $c = $('<div/>').appendTo($dest);

                    var list = crsaVariables.getVarsForCs(cs, false);

                    $.each(list, function(j, v) {

                        var fdef = {type: 'color', name: v.name, file_picker: true, file_picker_quotes: true};
                        var values = {};
                        values[v.name] = v.value;
                        var $fc = $.fn.crsa('addInputField', $c, {type: 'stylesheet', data: cs}, v.name, fdef, values, true).data('crsa-var', v);

                        var $del = $('<a/>', {href: '#', class: 'crsa-remove-var'}).html('<i class="fa fa-trash-o" />').on('click', function(e) {
                            var $field = $input.closest('.crsa-field');
                            var v = $field.data('crsa-var');
                            if(v.isInUse()) {
                                showAlert("Variable " + v.name + " is used in one or more open stylesheets.", "Can't remove it");
                            } else {

                                getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Remove variable " + v.name, false, cs);

                                crsaVariables.remove(v, function() {
                                    updateList();
                                    $('body').trigger('crsa-variables-changed', {list: [cs]});
                                });
                            }
                            e.preventDefault();
                        }).appendTo($fc);

                        var $input = $fc.find('input.crsa-input');

                        var undo_recorded = null;

                        if($input) {
                            $input.on('change input', function(event) {
                                //var $input = $(event.delegateTarget);
                                var $field = $input.closest('.crsa-field');
                                var v = $field.data('crsa-var');

                                if(!undo_recorded || undo_recorded != v) {

                                    getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Change " + v.name, false, cs);
                                    //console.log('undo recorded');
                                    undo_recorded = v;
                                }

                                var value = $input.val();
                                v.valueChanged(value);

                                if(event.type == 'change') {
                                    var $iframes = v.cs.getAttachedToPages();
                                    for(var i = 0; i < $iframes.length; i++) {
                                        var cp = getCrsaPageForIframe($iframes[i]);
                                        cp.autoSize();
                                    }
                                    $('body').trigger('crsa-variables-changed', {list: [cs]});
                                }
                            });
                        }
                    });
                });
            }

            updateList();

            $('body').off('crsa-rules-changed.vars crsa-stylesheets-changed.vars').on('crsa-rules-changed.vars crsa-stylesheets-changed.vars', function() {
                var p = new CrsaProfile(true);
                updateList();
                p.show('show Variables');
            });
        },
        showStylesheetsManager : function() {
            if($('.crsa-sm').length > 0) return;

            var $b = $('<ul/>', {class: 'crsa-man crsa-sm'});

            var notLoadedMessage = function() {
                showAlert("The stylesheet is not loaded. Load it (press on X in front of the stylesheet name in CSS panel) before renaming.", "Notice");
            }

            var showEditForm = function($li, save_as) {

                $li.append('<form class="form-inline" role="form">\
                    <div class="form-group" style="width:65%;">\
                    <label class="sr-only">Url</label>\
                    <div class="input-group" style="width:98%;">\
                    <input type="url" class="form-control url" placeholder="Url of .css or .less file">\
                    <span class="input-group-addon"><i class="fa fa-folder-open"></i></span>\
                    </div>\
                    <p class="help-block"></p>\
                    </div>\
                    <button type="submit" class="btn btn-default add">Add</button>\
                    <button class="btn btn-link cancel">Cancel</button>\
                    </form>');
                $li.find('>a,>button').hide();
                var $form = $li.find('form');

                var $url = $form.find('input.url');
                var $select_file = $form.find('span.input-group-addon');
                var $url_group = $url.closest('.form-group');
                var $url_help = $url_group.find('.help-block').hide();

                var cs = $li.data('crsa-cs');
                if(cs) {
                    $url.val(cs.url);
                    $form.find('button.add').html('Rename');
                } else {
                    $form.find('button.cancel').hide();
                }

                if(isApp()) {
                    $select_file.on('click', function(e) {
                        e.preventDefault();
                        crsaChooseFile(function(url, file) {
                            $url.val(url);
                        }, (cs != null ? crsaGetNameFromUrl(cs.url) : null) || (save_as ? 'style.css' : false));
                    });
                } else {
                    $select_file.remove();
                }

                $form.find('button.add').on('click', function(e) {
                    e.preventDefault();
                    var url = $.trim($url.val());

                    //url = service.getProxyUrl(url);

                    if(url.length == 0) {
                        $url_group.addClass('has-error');
                        $url_help.html("Enter the url of existing or new stylesheet.").show();
                        return;
                    }
                    if(cs) {
                        var a = findCrsaStylesheetForUrl(url, true);
                        if(a.length > 0 && a[0] != cs) {
                            $url_group.addClass('has-error');
                            $url_help.html("File with this url is already loaded.").show();
                        } else if(!cs.loaded) {
                            notLoadedMessage();
                        } else {
                            cs.setUrl(url);
                            cs.changed = true;
                            cs.reattachToAll(function() {
                                $('body').trigger('crsa-stylesheets-changed');
                                updateList();
                            });
                            if(isApp()) {
                                showAlert("Save the stylesheet or the page to which this stylesheet is attached to actually save it under this new name.", "Notice");
                            }
                        }
                    } else {
                        if(!crsaIsAbsoluteUrl(url)) {
                            var selectedPage = wfbuilder.getSelectedPage();
                            var cp = getCrsaPageForIframe(selectedPage);
                            if(cp) {
                                url = crsaCombineUrlWith(cp.url, url);
                                $url.val(url);
                            }
                        }
                        if(findCrsaStylesheetForUrl(url, true).length > 0) {
                            $url_group.addClass('has-error');
                            $url_help.html("File with this url is already loaded.").show();
                        } else {
                            $url_group.removeClass('has-error');
                            $url_help.hide();
                            var newcs = new CrsaStylesheet();
                            newcs.changed = true;
                            newcs.loaded = true;
                            newcs.load(url, function() {
                                crsaStylesheets.push(newcs);
                                updateList();
                                showAlert('Attach the new stylesheet to the page if you want to use it on that page. Btw, one stylesheet can be attached to multiple pages.', 'A Tip');
                            });
                        }
                    }

                });

                $form.find('button.cancel').on('click', function(e) {
                    var cs = $li.data('crsa-cs');
                    if(cs) {
                        $form.remove();
                        $li.find('>a,>button').show();
                        e.preventDefault();
                    }
                });
            }

            var updateList = function() {
                $b.html('');
                var list = crsaStylesheets;
                var selectedPage = wfbuilder.getSelectedPage();
                //var ps = getCrsaPageStylesForPage(selectedPage);

                for(var i = 0; i < list.length; i++) {
                    var cs = list[i];
                    if(cs.inline) continue;
                    var $li = $('<li/>').appendTo($b).data('crsa-cs', cs);

                    var $a = $('<span/>', {}).html(cs.name + (cs.changed ? ' *' : '')).appendTo($li);

                    var $dup = $('<a/>', {href: '#'}).html("Duplicate").appendTo($li);
                    var $edit = $('<a/>', {href: '#'}).html("Rename").appendTo($li);
                    var $close = $('<a/>', {href: '#'}).html("Close").appendTo($li);
                    var $save = null;
                    if(cs.changed && isApp() && cs.loaded) {
                        $save = $('<a/>', {href: '#'}).html("<b>Save</b>").appendTo($li);
                    }

                    $('<div/>', {}).html(cs.url).appendTo($li);

                    var $add;
                    if(selectedPage) {
                        var cp = getCrsaPageForIframe(selectedPage);
                        if(!cs.isEnabledForPage(selectedPage.get(0))) {

                            $add = $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-reply"></i> Attach to ' + cp.name).appendTo($li);
                        } else {
                            $li.addClass('crsa-active');
                            $add = $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-times"></i> Detach from ' + cp.name).appendTo($li);
                        }

                        $add.on('click', function(e) {
                            var selectedPage = wfbuilder.getSelectedPage();
                            if(selectedPage) {
                                var iframe = selectedPage.get(0);
                                var $li = $(e.delegateTarget).closest('li');
                                var cs = $li.data('crsa-cs');
                                var ps = getCrsaPageStylesForPage(selectedPage);

                                if(!cs.loaded && false) {
                                    notLoadedMessage();
                                } else {

                                    var cp = getCrsaPageForIframe(selectedPage);
                                    if(cs.findAttachmentFor(iframe)) {
                                        cp.undoStack.add('Detach ' + cs.name);
                                        ps.detachFrom(cs);
                                        $li.removeClass('crsa-active');
                                        $('body').trigger('crsa-stylesheets-changed');
                                        cp.autoSize();
                                        updateList();
                                    } else {
                                        cp.undoStack.add('Attach ' + cs.name);
                                        $li.addClass('crsa-active');
                                        ps.attachTo(cs, null, function() {
                                            $('body').trigger('crsa-stylesheets-changed');
                                            cp.autoSize();
                                            updateList();
                                        });
                                    }
                                }
                            }
                            e.preventDefault();
                        });
                    }


                    $dup.on('click', function(e) {
                        var $li = $(e.delegateTarget).closest('li');
                        var cs = $li.data('crsa-cs');
                        if(!cs.loaded) {
                            notLoadedMessage();
                        } else {
                            cs.duplicate(function(new_cs) {
                                crsaStylesheets.push(new_cs);
                                updateList();
                            });
                        }

                        e.preventDefault();
                    });

                    $edit.on('click', function(e) {
                        var $li = $(e.delegateTarget).closest('li');
                        var cs = $li.data('crsa-cs');
                        if(!cs.loaded) {
                            notLoadedMessage();
                        } else {
                            showEditForm($li);
                        }
                        e.preventDefault();
                    });

                    $close.on('click', function(e) {
                        var $li = $(e.delegateTarget).closest('li');
                        var cs = $li.data('crsa-cs');
                        cs.cleanDomSs();
                        if(cs.dom_ss.length > 0) {
                            showAlert("This stylesheet is attached to at least one open document. Close the document or detach the stylesheet before closing it.", "Can't close this stylesheet");
                        } else {
                            var idx = crsaStylesheets.indexOf(cs);
                            crsaStylesheets.splice(idx, 1);
                            cs.unload();
                            $('body').trigger('crsa-stylesheets-changed');
                            updateList();
                        }
                        e.preventDefault();
                    });

                    if($save) {
                        $save.on('click', function(e) {
                            var $li = $(e.delegateTarget).closest('li');
                            var cs = $li.data('crsa-cs');

                            var fs = require('fs');

                            if(!crsaIsFileUrl(cs.url)) {
                                showAlert("This is a remote stylesheet. Rename it first, then save it.", "Can't save this stylesheet");
                            } else {
                                cs.save(crsaMakeFileFromUrl(cs.url), function(err) {
                                    if(err) {
                                        showAlert(err, "Can't save this stylesheet");
                                    } else {
                                        crsaQuickMessage(crsaGetNameFromUrl(cs.url) + ' saved!');
                                    }
                                    updateList();
                                }, fs);
                            }
                            e.preventDefault();
                        });
                    }

                }
                var $li = $('<li/>').appendTo($b);

                var tabs = '<ul class="nav nav-tabs">\
                    <li class="active"><a href="#ss-add-new" data-toggle="tab">New...</a></li>\
                    <li><a href="#ss-add-open" data-toggle="tab">Open file...</a></li>\
                    <li><a href="#ss-add-url" data-toggle="tab">Open url...</a></li>\
                </ul>\
                    <div class="tab-content">\
                        <div class="tab-pane active" id="ss-add-new"><p class="text-muted">Create a new stylesheet (if you select an existing stylesheet it will be loaded instead).</p></div>\
                        <div class="tab-pane" id="ss-add-open"><p class="text-muted">Open an existing stylesheet.</p></div>\
                        <div class="tab-pane" id="ss-add-url"><p class="text-muted">Enter an absolute or relative url of the stylesheet that you want to create or load.</p></div>\
                    </div>';

                if($tabs) $tabs.remove();
                if($tabsh) $tabsh.remove();
                $tabsh = $('<h4>Add stylesheet:</h4>').appendTo($main);
                $tabs = $(tabs).appendTo($main);
                showEditForm($tabs.find('#ss-add-new'), true);
                showEditForm($tabs.find('#ss-add-open'));
                showEditForm($tabs.find('#ss-add-url'));
            }
            var $tabs;
            var $tabsh;
            var $main = $('<div class="manager"/>').append($b);
            var $d = makeModalDialog("Stylesheets Manager", "Close", null, $main);
            updateList();

            $('body').on('crsa-page-selected', function(e, selectedPage) {
                updateList();
            });

        },
        showFrameworkManager : function(crsaPage) {
            var text;
            if(crsaPage) {
                text = 'Select which libraries and plugins you want to use with this page in <b>Lib</b> and <b>Prop</b> panels.';
            } else {
                text = 'The list of libraries and plugins. Select Libraries &amp; Plugins Manager for a specific page to manage which plugins are active for that page.';
            }
            var $div = $('<div><p class="text-muted">' + text + '</p></div>');
            var $b = $('<ul/>', {class: 'crsa-man crsa-fm'}).appendTo($div);

            var loadComponentLibrary = function() {
                service.selectAndLoadLibrary(function(project, f) {
                    updateList();
                });
            }

            var showEditForm = function($li) {
                $li.append('<form class="form-inline load-plugin" role="form">\
                    <h4>Load your own plugins</h4>\
                    <p><b>PLEASE LOAD ONLY PINEGROW PLUGINS!</b> Loading anything else <b>WILL</b> break the app.</p>\
                    <div class="form-group" style="width:65%;">\
                    <label class="sr-only" for="exampleInputEmail2">Url</label>\
                    <div class="input-group" style="width:98%;">\
                    <input type="url" class="form-control url" id="exampleInputEmail2" placeholder=".js file">\
                    <span class="input-group-addon"><i class="fa fa-folder-open"></i></span>\
                    </div>\
                    <p class="help-block"></p>\
                    </div>\
                    <button type="submit" class="btn btn-default add">Add</button>\
                    <button class="btn btn-link cancel">Cancel</button>\
                    </form>');
                $li.find('>a,>button').hide();
                var $form = $li.find('form').hide();

                var $url = $form.find('input.url');
                var $select_file = $form.find('span.input-group-addon');
                var $url_group = $url.closest('.form-group');
                var $url_help = $url_group.find('.help-block').hide();

                $form.find('button.cancel').hide();

                if(isApp()) {
                    $select_file.on('click', function(e) {
                        e.preventDefault();
                        crsaChooseFile(function(url, file) {
                            $url.val(url);
                        });
                    });
                } else {
                    $select_file.remove();
                }

                $form.find('button.add').on('click', function(e) {
                    e.preventDefault();
                    var url = $.trim($url.val());

                    if(url.length == 0) {
                        $url_group.addClass('has-error');
                        $url_help.html("Select the file first.").show();
                        return;
                    }
                    var file = crsaMakeFileFromUrl(url);
                    if(service.findFrameworkWithUrl(url)) {
                        $url_group.addClass('has-error');
                        $url_help.html("This file is already loaded.").show();
                    } else {
                        $url_group.removeClass('has-error');
                        $url_help.hide();

                        if(confirm("Are you sure? Only Pinegrow PLUGINS and COMPONENTS can be loaded. Anything else (framework JavaScript files, etc...) WILL break the app.")) {

                            service.loadFrameworkFromUrl(url, true, function(err) {
                                if(err) {
                                    showAlert('Unable to load ' + file + '. ' + err, "Unable to load plugin.");
                                }
                                updateList();
                            });
                        }

                    }
                });
            }

            var updateList = function() {
                $b.html('');
                var list = service.getFrameworks();

                $.each(list, function(i, fm) {
                    if(!fm.show_in_manager) return true;
                    var $li = $('<li/>').appendTo($b).data('crsa-fm', fm);

                    var $a = $('<span/>', {}).html(fm.name).appendTo($li);
                    $('<i class="fa fa-check"></i>').appendTo($a);

                    var $add;
                    var $unload;
                    var activated = false;
                    if(crsaPage) {
                        if(crsaPage.frameworks.indexOf(fm) < 0) {
                            $add = $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-plus"></i> Activate').appendTo($li);
                        } else {
                            $li.addClass('crsa-active');
                            $add = $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-minus"></i> Deactivate').appendTo($li);
                            activated = true;
                        }

                        $add.on('click', function(e) {

                            var $li = $(e.delegateTarget).closest('li');
                            var fm = $li.data('crsa-fm');

                            var onInitDone = function(f) {
                                //added, check for resources
                                if(f.resources.has()) {
                                    service.showUpdateResourcesDialog(crsaPage,  service.getCurrentProject(), [f]);
                                }
                                updateList();
                            }

                            var idx = crsaPage.frameworks.indexOf(fm);
                            if(idx >= 0) {
                                crsaPage.removeFramework(fm);
                                $li.removeClass('crsa-active');
                                updateList();
                                crsaPage.setPageChanged(true);
                            } else {
                                if(!crsaPage.addFramework(fm, false, onInitDone)) {
                                    showAlert('Only one ' + fm.type + ' library or plugin can be added to a page at the same time. Remove the other one first.', "Could not add framework");
                                } else {
                                    $li.addClass('crsa-active');
                                    //if project, add to all open pages from project
                                    var project = service.getCurrentProject();
                                    if(project) {
                                        var first = true;
                                        project.forEachOpenPage(function(page) {
                                            page.addFramework(fm, false, first ? onInitDone : null);
                                            first = false;
                                        }, crsaPage);
                                    }

                                }

                                crsaPage.setPageChanged(true);
                            }

                            e.preventDefault();
                        });
                    }

                    if(activated && fm.resources.has()) {
                        $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-files-o"></i> Resources').appendTo($li)
                            .on('click', function(e) {
                                e.preventDefault();
                                var $li = $(e.delegateTarget).closest('li');
                                var fm = $li.data('crsa-fm');
                                service.showUpdateResourcesDialog(crsaPage,  service.getCurrentProject(), [fm]);
                            });
                    }


                    if(fm.changed) {
                        $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-save"></i> <b>Save</b>').appendTo($li)
                            .on('click', function(e) {
                                e.preventDefault();
                                var $li = $(e.delegateTarget).closest('li');
                                var fm = $li.data('crsa-fm');

                                if(fm.pluginUrl) {
                                    fm.save(fm.pluginUrl, function() {
                                        crsaQuickMessage("Library saved.");
                                        updateList();
                                        service.frameworksChanged();
                                    });
                                } else {
                                    crsaChooseFile(function(url, file) {
                                        fm.save(file, function() {
                                            crsaQuickMessage("Library saved.");
                                            updateList();
                                            service.frameworksChanged();
                                        });
                                    }, fm.getFileName());
                                }

                            });
                    }

                    if(fm.pluginUrl) {
                        $('<a/>', {class: 'crsa-sm-attach', href: '#'}).html('<i class="fa fa-times"></i> Unload').appendTo($li)
                            .on('click', function(e) {
                                e.preventDefault();
                                var $li = $(e.delegateTarget).closest('li');
                                var fm = $li.data('crsa-fm');
                                if(fm.changed) {
                                    showAlert("Plugin has unsaved changes. Sure you want to close it?", "Unsaved changes", "Cancel", "Close it", null, function() {
                                        service.unloadFramework(fm);
                                        updateList();
                                    });
                                } else {
                                    service.unloadFramework(fm);
                                    updateList();
                                }
                            });
                        $('<div/>', {}).html(fm.pluginUrl).appendTo($li);
                    }


                });
                var $li = $('<li/>').appendTo($b);
                showEditForm($li);
            }

            updateList();

            $div.append('<p><a href="#" class="load-lib">Load component library</a> - <a href="#" class="show-load-plugins">Load plugin</a> - <a href="https://github.com/matjaztrontelj/PinegrowCommunity/wiki" target="_blank" class="link">Learn how to create Pinegrow plugins.</a></p>')

            $div.find('a.load-lib').on('click', function(e) {
                //debugger;
                e.preventDefault();
                loadComponentLibrary();
            });

            $div.find('a.show-load-plugins').on('click', function(e) {
                //debugger;
                e.preventDefault();
                $d.find('.load-plugin').show();
            });
            var $d = makeModalDialog(crsaPage ? "Libraries &amp; Plugins Manager for " + crsaPage.name : "Libraries &amp; Plugins Manager", "Close", null, $div);

            if(isApp()) {
                $d.find('a.link').on('click', function(e) {
                    var url = $(e.delegateTarget).attr('href');
                    if(url) {
                        e.preventDefault();
                        var gui = require('nw.gui');
                        var url = $(e.delegateTarget).attr('href');
                        gui.Shell.openExternal(url);
                    }
                })
            }

            $('body').on('crsa-framework-loaded', function(e, fm) {
                updateList();
            });
        }

    };


    function editRuleSource(rule) {

        var restore_on_cancel = false;

        var onRulesChangedInExternalEditor = function(e, data) {

            if(data && data.list && data.eventType && data.eventType == 'editor') {
                if(data.list.indexOf(cs) >= 0) {
                    service.showQuickMessage('Stylesheet was modified in external editor.');
                    restore_on_cancel = false;
                    editorData.close();
                }
            }
        }

        $('body').on('crsa-rules-changed', onRulesChangedInExternalEditor);

        var onClose = function() {
            $('body').off('crsa-rules-changed', onRulesChangedInExternalEditor);
        }

        var editorData = showCodeEditor("text/css", "Edit CSS rule code", 'edit-rule-code',
            function() {
                //onchange
                restore_on_cancel = true;
                applySource(mirror.getDoc().getValue());
            },
            function() {
                //on ok
                try {
                    cs.genRegenerateAndSetCssSource(function() {
                        $('body').trigger('crsa-stylesheets-changed', {list: [cs]});
                    });
                } catch(err) {};
                onClose();

            }, function() {
                //on cancel
                try {
                    if(restore_on_cancel) {
                        getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.remove();
                        rule.edited_source = original_source;
                        cs.genForgetCachedSource();
                        cs.genRegenerateAndSetCssSource(function () {
                            $('body').trigger('crsa-stylesheets-changed', {list: [cs]});
                        });
                    }
                } catch(err) {}
                onClose();
            });

        var mirror = editorData.mirror;
        var $dialog = editorData.dialog;
        var $chk = $dialog.find('.modal-footer label');

        var cs = rule.crsa_stylesheet;

        getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Edit CSS rule", false, cs);

        var code_has_errors = false;

        var applySource = function(s) {

            rule.edited_source = s;
            cs.genRegenerateRule(rule, function() {

                var error = cs.genGetError();

                if(error) {
                    var lines = s.split("\n").length;

                    code_has_errors = true;
               /*     codeEditor.getSession().setAnnotations([{
                        row: (lines >= error.line) ?  error.line - 1 : 0,
                        column: error.column,
                        text: "Syntax error: " + error.message,
                        type: "error" // also warning and information
                    }]);*/
                } else {
                    cs.changed = true;
                /*    if(code_has_errors) {
                        codeEditor.getSession().clearAnnotations();
                        code_has_errors = false;
                    }*/
                }
                $('body').trigger('crsa-rule-changed-in-editor', {list: [cs]});

            });
        }


        var original_source = rule.crsa_stylesheet.genGetSourceForRules([rule]);

        mirror.getDoc().setValue(original_source);
        mirror.getDoc().clearHistory();
    }




    var initDocumentStylesheet = function($iframes, done) {
        var count = $iframes.length;

        $iframes.each(function(i,e) {
            var doc = e.contentDocument || e.contentWindow.document;
            var head  = doc.getElementsByTagName('head')[0];
            var $frame = $(e);

            var ss = getStylesheetByTitle(doc, opts.title);
            if(!ss) {
                var style = $('<style/>', { title : opts.title}).appendTo($(head));

                ss = style.get(0).sheet;
                $frame.data('crsa-css-ss', ss);
                count--;
                if(count <= 0 && done) done();
           /*
                setTimeout(function() {
                    ss = getStylesheetByTitle(doc, opts.title);
                    if(!ss) {
                        $.error("Could not add " + opts.title + " stylesheet.");
                    }
                    $frame.data('crsa-css-ss', ss);
                    count--;
                    if(count <= 0 && done) done();
                },100);
                */
           /*     var url = "data:text/css;charset=utf-8;base64,LyogZW1wdHkgKi8=";
                url = window.crsa_empty_css;

                loadStyleSheet(e, url, function(stylesheet) {
                    if(stylesheet) {
                        $frame.data('crsa-css-ss', stylesheet);
                    } else {
                        $.error("Could not add " + opts.title + " stylesheet.");
                    }
                    count--;
                    if(count <= 0 && done) done();
                });*/
            } else {
                $frame.data('crsa-css-ss', ss);
                count--;
                if(count <= 0 && done) done();
            }
        });
    }

    var loadStyleSheet = function(iframe, path, fn, $replaceElement ) {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        var head = doc.getElementsByTagName( 'head' )[0];
         // reference to document.head for appending/ removing link nodes
        //var link = doc.createElement( 'link' );           // create the link node
        //link.setAttribute( 'href', path );
        //link.setAttribute( 'rel', 'stylesheet' );
        //link.setAttribute( 'type', 'text/css' );

        var code = '<link href="' + path + '" rel="stylesheet" type="text/css">';
        var pgHead = new pgQuery($(head));
        var pgLink = new pgQuery().create(code);
        var link = pgLink.get(0).el;

        var sheet, cssRules;
        // get the correct properties to check for depending on the browser
        if ( 'sheet' in link ) {
            sheet = 'sheet'; cssRules = 'cssRules';
        }
        else {
            sheet = 'styleSheet'; cssRules = 'rules';
        }

        var interval_id = setInterval( function() {                     // start checking whether the style sheet has successfully loaded
                try {
                    if ( link[sheet]) { // SUCCESS! our style sheet has loaded
                        clearInterval( interval_id );                      // clear the counters
                        clearTimeout( timeout_id );
                        fn( link[sheet] );           // fire the callback with success == true
                    }
                } catch( e ) {} finally {}
            }, 10 ),                                                   // how often to check if the stylesheet is loaded
            timeout_id = setTimeout( function() {       // start counting down till fail
                clearInterval( interval_id );             // clear the counters
                clearTimeout( timeout_id );
                //head.removeChild( link );
                pgLink.remove();
                // since the style sheet didn't load, remove the link node from the DOM
                fn( null ); // fire the callback with success == false
            }, 10000 );                                 // how long to wait before failing

        if($replaceElement) {
            var pgRe = new pgQuery($replaceElement);
            pgRe.replaceWith(pgLink.get(0));
            //$replaceElement.replaceWith($(link));
        } else {
            pgHead.append(pgLink);
            //head.appendChild( link );  // insert the link node into the DOM and start loading the style sheet
        }

        return link; // return the link node;
    }

    var filterRules = function($rules, s ){
        var o;
        if( !s ) s = /./;//just keep them all.
        if( s.split ){
            o = $.trim(s).toLowerCase().split(/\s*,\s*/);
            s = function(){
                if(!this.selectorText) return false; //MTCH
                return !!$.grep( this.selectorText.toLowerCase().split(/\s*,\s*/), function( sel ){
                    return $.inArray( sel, o ) != -1;
                }).length;
            };
        }else if( s.exec ){//string regex, or actual regex
            o = s;
            s = function(){ return o.test(this.selectorText); };
        }
        var r = $([]).pushStack($.grep($rules, function( e, i ){
            return s.call( e, i );
        }));
        return r;
    };

    var getStylesheetByTitle = function(doc, unique_title) {
        //return last with href
        var last_good = null;
        for(var i=0; i<doc.styleSheets.length; i++) {
            var sheet = doc.styleSheets[i];
            if(sheet.href && sheet.href.length > 0 && sheet.href.indexOf('edit.inline.css')<0) last_good = sheet;
          //  if(sheet.title == unique_title) {
          //      return sheet;
          //  }
        }
        return last_good;
    };

    var regenerateCssFromLessSource = function(done, param) {
        if(typeof param == 'undefined') param = null;
        less_parser.parse(methods.getLessSource() + "\n" + less_variables_string, function (err, tree) {
            if (err) { return console.error(err) }
            methods.processLessTree(tree);
            var css = tree.toCSS();
            methods.setAllCssText(css);
            if(done) done(param);
        });
    };

    var setLessRuleSource = function(rule, source, done) {
        less_parser.parse(source + "\n" + less_variables_string, function (err, tree) {
            if (err) { return console.error(err) }

            var rules = [];

            for(var ri = 0; ri < tree.rules.length; ri++) {
                var r = tree.rules[ri];
                methods.processTreeRule(r, rules, true);
            }
            $.each(rules, function(i, r) {
                var css = tree.toCSS();
                methods.replaceRule(rule, css);
                return false;
            });
            if(done) done();
        });
    };

    // Plugin defaults – added as a property on our plugin function.
    $.fn.crsacss.defaults = {
        title : 'crsa'
    };


    function setUndoPointForCss() {
        crsaundo.add('css', methods.getLessSource(), 'name');
    }

    function getIframeBody(iframe) {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        return doc.body;
    }

    function getIframeDocument(iframe) {
        return iframe.contentDocument || iframe.contentWindow.document;
    }

    var CrsaClassManager = function($dest) {

        var onlyClasses = false;
        var $refElement = null;

        var $main_div = $('<div/>', {class: 'crsa-cm-main clearfix'}).appendTo($dest);
        var $rules_div = $('<div/>', {class: 'crsa-cm-rules'}).appendTo($main_div);
        var $props_div = $('<div/>', {class: 'crsa-cm-props'}).appendTo($main_div);

        var selectedPage = null;
        var iframe = null;
        var show_add_class_help = true;
        this.filter_set_in_props_mode = false;
        this.only_active_user_choice = false;


        this.setReferenceElement = function($el, skip_refresh) {
            $refElement = $el;
            if(!skip_refresh) {
                updateUsedClasses();
            }
            if($add_class_help) {
                if($refElement) {
                    $add_class_help.show();
                } else {
                    $add_class_help.hide();
                }
            }
        }

        this.setShowOnlyClasses = function(oc, skip_refresh) {
            onlyClasses = oc;
            if(!skip_refresh) {
                this.refresh();
            }
        }

        this.setSelectedPage = function($p, skip_refresh) {
            selectedPage = $p;

            iframe = selectedPage ? selectedPage.get(0) : null;
            if(!skip_refresh) {
                this.refresh();
            }
        }

        var showPageDimensionInfo = function() {
            var cp = getCrsaPageForIframe(selectedPage);
            if(cp) {
                $only_visible.find('span').html('Visible at ' + cp.deviceWidth + 'px');
            }
        }


        var filter_cs_list = [];
        var shown_cs_list = [];

        var only_active = false;
        var only_visible = false;

        this.refresh = function() {

            
            showPageDimensionInfo();
            updateStylesheetList();
            updateRules();
            updateUsedClasses();

            resizeRulesList();


        }

        //////////////////////////////////////////////////////
        //sws//
        //this.setSelectedPage(wfbuilder.getSelectedPage(), true);
        //this.setSelectedPage(wfbuilder.getSelectedPage(), true);
        //sws//
        //////////////////////////////////////////////////////


        var resizeRulesList = function() {
            var $sslist = $dest.find('.cm-sslist');
            var $list = $dest.find('.crsa-cm-list');

            //sws//???
            if ($sslist.height()){
                $list.css('top', ($sslist.height() + 140 + 15) + 'px');
            }else{
                $("#css_").addClass("active");
                $list.css('top', ($sslist.height() + 140 + 15) + 'px');
                $("#css_").removeClass("active");

            }
            


            

        }

        this.resizeRulesList = function() {
            resizeRulesList();
        }

        /*
        $(window).on('resize', function() {

        });
        */

        $('body').on('crsa-window-changed', function(e, crsaPage) {
            if(crsaPage == getCrsaPageForIframe(selectedPage)) {
                showPageDimensionInfo();
                if(only_visible) {
                    updateUsedClasses();
                }
            }
        });


        var closeAllPropertiyForms = function() {
            $('.crsa-cm-props').html('');
            _this.showListPanel(false);
        }
        $('<h2/>').html('Stylesheets').appendTo($rules_div);
        var $psul = $('<ul/>', {class: 'cm-sslist'}).appendTo($rules_div);

        var setSSHidden = function(cs, $li, hidden) {
            cs.ignore = hidden;
            if(!hidden) {
                var idx = filter_cs_list.indexOf(cs);
                if(idx >= 0) filter_cs_list.splice(idx, 1);
            } else {
                var idx = filter_cs_list.indexOf(cs);
                if(idx < 0) filter_cs_list.push(cs);
            }
        }

        var showSSHidden = function(cs, $li) {
            var $i = $li.find('i.filter');
            if(!cs.ignore) {
                $i.addClass('fa-check').removeClass('fa-times');
            } else {
                $i.addClass('fa-times').removeClass('fa-check');
            }
        }

        var updateStylesheetList = function() {

            $psul.html('');
            if(!selectedPage) {
                $psul.sortable('refresh');
                filter_cs_list = [];
                return;
            }

            var ps = getCrsaPageStylesForPage(selectedPage);

            if(!ps) return;
            var allSheets = ps.getAllCrsaStylesheets();

            $.each(allSheets, function(i, cs) {

                var $li = $('<li/>').appendTo($psul).data('crsa-cs', cs);
                var $fil = $('<i/>', {class: 'filter fa fa-fw'}).appendTo($li).addClass(filter_cs_list.indexOf(cs) < 0 ? 'fa-check' : 'fa-times');
                var $vis = $('<i/>', {class: 'fa fa-fw ss-enable'}).appendTo($li).addClass(cs.isEnabledForPage(iframe) ? 'fa-eye' : 'fa-eye-slash');
                var $name = $('<a/>', {href: '#'}).html(cs.name).appendTo($li);
                //var $detach = $('<a/>', {href: '#'}).html('   x');//.appendTo($li);
                var $move = $('<i/>', {class: 'fa fa-bars'}).appendTo($li);

                $fil.tooltip({container: 'body', placement: 'top', title: 'Hide / show stylesheet rules in the list below.', trigger: 'hover'});
                $vis.tooltip({container: 'body', placement: 'top', title: 'Disable / enable the stylesheet.', trigger: 'hover'});

                showSSHidden(cs, $li);

                if(cs.genGetError()) $name.addClass('has-css-error');

                var clickOnName = function(cs) {
                    var p = new CrsaProfile(true);

                    cs.ignore = false;
                    filter_cs_list = [];
                    $.each(allSheets, function(i, c) {
                        if(c != cs) {
                            filter_cs_list.push(c);
                            c.ignore = true;
                        }
                    });

                    p.show('    -con 1');

                    if(!cs.ignore && !cs.loaded) {
                        cs.load(cs.url, function() {
                            $('body').trigger('crsa-stylesheets-changed');
                            crsaQuickMessage("CSS rules list updated.");
                        });
                    } else {
                        //$('body').trigger('crsa-stylesheets-changed');

                        window.requestAnimationFrame(function() {
                            updateStylesheetList();
                            p.show('        -con 1.1');

                            updateRules();
                            p.show('        -con 1.2');

                            updateUsedClasses();
                            p.show('        -con 1.3');

                            closeAllPropertiyForms();
                            p.show('        -con 1.4');

                            resizeRulesList();
                        });

                        //crsaQuickMessage("CSS rules list updated.");

                        p.show('    -con 2');
                    }

                    p.show('    -con 3');
                }

                $name
                    .on('click', function(e) {
                        var $li = $(e.delegateTarget).closest('li');
                        var cs = $li.data('crsa-cs');
                        //var $i = $li.find('i.filter');
                        //var enabled = $i.hasClass('fa-times');
                        var p = new CrsaProfile(true);
                        clickOnName(cs);




                        p.show('clickOnName');
                        e.preventDefault();
                    })
                    .on('contextmenu', function(e) {
                        e.preventDefault();
                        var $menu = new CrsaContextMenu();
                        var $li = $(e.delegateTarget).closest('li');
                        var cs = $li.data('crsa-cs');

                        $menu.add("Show only these CSS rules", null, function() {
                            clickOnName(cs);
                        });
                        if(cs.ignore || !cs.loaded) {
                            $menu.add("Load &amp; Show", null, function() {
                                clickOnFilterSS($li, cs);
                            });
                        } else {
                            $menu.add("Ignore", null, function() {
                                clickOnFilterSS($li, cs);
                            });
                        }

                        if(cs.isEnabledForPage(iframe)) {
                            $menu.add("Disable", null, function() {
                                clickOnEnableSS(cs, $li);
                            });
                        } else {
                            $menu.add("Enable", null, function() {
                                clickOnEnableSS(cs, $li);
                            });
                        }

                        if(!cs.inline) {
                            $menu.add("Reload", null, function() {
                                _this.reloadStylesheet(cs);
                            });
                        }

                        $menu.showAt(e.pageX, e.pageY);
                    })

                var clickOnFilterSS = function($li, cs) {
                    setSSHidden(cs, $li, !cs.ignore);
                    showSSHidden(cs, $li);

                    $(".tooltip").hide();

                    if(!cs.ignore && !cs.loaded) {
                        cs.load(cs.url, function() {
                            $('body').trigger('crsa-stylesheets-changed');
                        });
                    } else {
                        $('body').trigger('crsa-stylesheets-changed');
                    }
                }

                $fil.on('click', function(e) {
                    var $li = $(e.delegateTarget).closest('li');
                    var cs = $li.data('crsa-cs');

                    clickOnFilterSS($li, cs);
                    e.preventDefault();
                });

                var clickOnDetachSS = function(cs) {
                    var cp = getCrsaPageForIframe(wfbuilder.getSelectedPage());
                    cp.undoStack.add('Detach ' + cs.name);

                    ps.detachFrom(cs);
                    cp.autoSize();

                    $('body').trigger('crsa-stylesheets-changed');
                }

                /*
                not used

                $detach.on('click', function(e) {
                    var $li = $(e.delegateTarget).closest('li');
                    var cs = $li.data('crsa-cs');

                    clickOnDetachSS(cs);
                    e.preventDefault();
                });
                */

                var clickOnEnableSS = function(cs, $li) {
                    var $i = $li.find('i.ss-enable');
                    var enabled = cs.isEnabledForPage(iframe);
                    cs.setEnabledForPage(iframe, !enabled);
                    if(!enabled) {
                        $i.addClass('fa-eye').removeClass('fa-eye-slash');
                    } else {
                        $i.addClass('fa-eye-slash').removeClass('fa-eye');
                    }

                    //sws//???
                    var cp = getCrsaPageForIframe(wfbuilder.getSelectedPage().$iframe);
                    
                    cp.autoSize();

                    updateRules();
                }

                $vis.on('click', function(e) {

                    var $li = $(e.delegateTarget).closest('li');
                    var cs = $li.data('crsa-cs');

                    clickOnEnableSS(cs, $li);
                    e.preventDefault();
                });

            });
            $psul.sortable('refresh');
        }

        //sws//block:
        // $('<a/>', {class: 'cm-sslist-manage', href:"#"}).html('+ Manage...').appendTo($rules_div).on('click', function(e) {
        //     $.fn.crsacss('showStylesheetsManager');
        //     e.preventDefault();
        // });




        $psul.sortable({handle: 'i.fa-bars', axis: "y", scroll: false })
            .on("sortupdate", function(event, ui) {
                var list = [];
                $psul.find('>li').each(function(i,li) {
                    var cs = $(li).data('crsa-cs');
                    if(cs) list.push(cs);
                });

                //sws//block:
                //getCrsaPageForIframe(wfbuilder.getSelectedPage().$iframe).undoStack.add("Reorder stylesheets");
                
                getCrsaPageStylesForPage(selectedPage).reorder(list, function() {
                    updateRules();
                    closeAllPropertiyForms();
                });
            });

        updateStylesheetList();

        resizeRulesList();

        $('body').on('crsa-stylesheets-changed', function() {

            var p = new CrsaProfile(true);
            updateStylesheetList();
            p.show('updateStylesheetList');

            updateRules();
            p.show('updateRules');

            updateUsedClasses();
            p.show('updateUsedClasses');

            closeAllPropertiyForms();
            p.show('closeAllPropertiyForms');

            resizeRulesList();
        });

        $('body').on('crsa-stylesheets-properties-changed', function() {
            closeAllPropertiyForms();
        })


        var $css_var_contianer = $('<div class="crsa-css-var-header"></div').appendTo($rules_div);
        $('<h2/>').html('CSS Rules').appendTo($css_var_contianer);
        var $varBtn = $('<a/>', {href: '#', class: 'crsa-show-var'}).html('Vars').appendTo($css_var_contianer);
        $varBtn.on('click', function () {
            event.preventDefault();
            // $('#crsa-vars-panel').data('panel').show();
        });

        if(service.getSetting('use-less', '1') != '1') {
            $varBtn.hide();
        }

        var $controls = $('<div style="position:relative;"></div>').appendTo($rules_div);
        var $input = $('<input/>', {'class' : 'crsa-cm-input form-control filter-form', placeholder: 'search'}).appendTo($controls);
        crsaAddCancelSearch($input, 'top: 6px;right: 20px;');

        var $only_active = $('<label class="css-opt-label"><input class="control-label" type="checkbox" value="1">&nbsp;<span>Active</span></label>').appendTo($controls);
        var $only_visible = $('<label class="css-opt-label"><input class="control-label" type="checkbox" value="1">&nbsp;<span>Visible</span></label>').appendTo($controls);

        $only_active.find('>input').on('change', function(e) {
            only_active = $(e.delegateTarget).is(':checked');
            _this.only_active_user_choice = only_active;
            updateUsedClasses();
        })

        $only_active.tooltip({container: 'body', placement: 'top', title: 'Show only active rules for the selected element.', trigger: 'hover'});

        this.setOnlyActive = function(a, refresh) {
            if(typeof refresh == 'undefined') refresh = true;
            $only_active.find('>input').prop('checked', a);
            only_active = a;
            if(refresh) {
                updateUsedClasses();
            }
        }

        $only_visible.find('>input').on('change', function(e) {
            only_visible = $(e.delegateTarget).is(':checked');
            updateUsedClasses();
        })

        $only_visible.tooltip({container: 'body', placement: 'top', title: 'Show only rules that match the current window size.', trigger: 'hover'});


        var filter = null;

        var $add_class_help = null;
        /*
        var $add_class_help = $('<div class="alert alert-info"><button type="button" class="close">×</button>Click on <i class="fa fa-reply"></i> to apply class to selected element.</div>').appendTo($rules_div);
        $add_class_help.find('button.close').on('click', function(e) {
            e.preventDefault;
            $add_class_help.animate({opacity:0}, 250, function() {
                $add_class_help.remove();
                $add_class_help = null;
            });
        });
        $add_class_help.hide();
        */

        this.setFilter = function(f, refresh) {
            if(typeof refresh == 'undefined') refresh = true;
            filter = f;
            $input.val(f);
            if(refresh) {
                updateRules();
                updateUsedClasses();
            }
        }

        var _this = this;

        var $ul = $('<ul/>', {'class' : 'crsa-cm-list'}).appendTo($rules_div);

        var scroll_$heads;

        $ul.on('scroll', function(event) {
            var top = $ul.scrollTop();
            var $heads = scroll_$heads;
            var h = $ul.height();

            var bodyRect = $ul.get(0).getBoundingClientRect();

            if(bodyRect.width == 0) return;

            $heads.each(function(i, head) {
                var $head = $(head);
                var $spacer = $head.next();
                var $list = $spacer.next();
               // var o = $list.position();
                var floats = $head.hasClass('floating');
                var headh = $head.outerHeight() + 8;

                //if(i != 1) return;
                //console.log('headh ' + headh);

                var elemRect = $list.get(0).getBoundingClientRect();

                var offset = (elemRect.top - bodyRect.top);// + top;

                //console.log('Element is ' + offset + ' vertical pixels from <body>');

                if(!floats) {
                    if(offset < headh) {
                        //console.log(offset, headh, top);
                        $head.addClass('floating');
                        floats = true;
                        //$list.css('top', headh + 'px');
                        $spacer.show();
                    } else {

                    }
                } else {
                    if(offset > headh) {
                        $head.removeClass('floating');
                        $head.css('top', '0px');
                        //$list.css('top', '0px');
                        $spacer.hide();
                        floats = false;
                    }
                }
                if(floats) {
                    $head.css('top', top + 'px');
                }
            });
        });

        $ul.get(0).addEventListener('click', function(event) {
            debugger;//sws//temp:
            //find('.crsa-cm-apply').on('click', function(event) {
            var stop = false;
            var $target = $(event.target);

            if($target.closest('.crsa-cm-apply').length) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);
                var se = service.getSelectedElement();


                if(!se || se.type != 'element') return;

                if(r.classes) {
                    if(r.classes.length == 1) {
                        if(se.data.hasClass(r.class)) {
                            $dest.trigger('crsa-cm-class-remove', r.class);
                        } else {
                            $dest.trigger('crsa-cm-class-add', r.class);
                        }
                    } else {
                        var $ul = $li.data('assign-menu');
                        if($ul && $ul.is(':visible')) {
                            $ul.remove();
                        } else {
                            var $menu_ul = showContextMenuForRule($li, true);
                            $li.data('assign-menu', $menu_ul);
                        }
                    }
                }
                stop = true;
            } else if($target.closest('.crsa-cm-code').length) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);
                editRuleSource(r);
                stop = true;

            } else if($target.closest('.crsa-cm-remove').length) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);
                var $csli = $li.closest('li.crsa-stylesheet');
                var cs = $csli.data('cs');
                var $input = $li.find('input');
                var sel = $.trim($input.val());

                //sws//block:
                //getCrsaPageForIframe(wfbuilder.getSelectedPage().$iframe).undoStack.add("Remove CSS rule", false, cs);

                cs.removeLessRule(r);
                cs.genRegenerateAndSetCssSource(function() {
                    $dest.trigger('crsa-cm-removed', r);
                    $body.trigger('crsa-rules-changed', {list: [cs]});
                });
                stop = true;

            } else if($target.closest('.crsa-cm-edit').length) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);
                if(r.selector && !r.multiple_values) {
                    //sws//
                    _this.editRule(r);
                } else {
                    editRuleSource(r);
                    if(r.multiple_values) {
                        crsaQuickMessage('Editing properties is not possible because the rule contains <b>multiple values for the same property</b> or <b>advanced LESS features</b>.', 4000);
                    }
                }
                stop = true;
            }
            if(stop) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        $ul.get(0).addEventListener('contextmenu', function(event) {
            var $target = $(event.target);

            if($target.closest('.crsa-cm-edit').length) {
                var $li = $target.closest('div');
                showContextMenuForRule($li, false);
            }
            event.preventDefault();
            event.stopPropagation();
        }, true);

        var $rule_menu = $('<i class="fa fa-trash-o crsa-cm-remove"></i><i class="fa fa-code crsa-cm-code"></i><i class="fa fa-bars crsa-cm-move"></i>');

        $ul.get(0).addEventListener('mouseenter', function(event) {
            var $target = $(event.target);

            //console.log($target.get(0));

            //$target = $target.closest('.crsa-cm-edit');

            if($target.is('.crsa-cm-edit')) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);
                if(r && r.selector) {
                    try {
                        var $els = $(getIframeBody(selectedPage.get(0))).parent().find(r.selector);
                        $.fn.crsa('highlightElement', $els);
                    } catch(err) {
                        //console.log(err);
                    }
                }
               // var $rule_menu = $('<i class="fa fa-trash-o crsa-cm-remove"></i><i class="fa fa-code crsa-cm-code"></i><i class="fa fa-bars crsa-cm-move"></i>');

                $target.append($rule_menu);

                //event.preventDefault();
                //event.stopPropagation();

            } else if($target.is('.crsa-cm-code')) {
                if(r) {
                    var $el = $('<div/>');
                    var $pre = $('<pre/>').html(r.crsa_stylesheet.genGetSourceHtmlForRule(r)).appendTo($el);
                    $('<p>Click on <i class="fa fa-code"></i> to edit rule code.<br />Click on <span>.Selector</span> to edit rule properties.</p>').appendTo($el);
                    $.fn.crsa('showPreview', $li, $el, 'cm-preview', function(w) {
                        return getPreviewPosition(w, $target.closest('.wfb-comp.pc-panel'));
                    });
                }
            }
            //event.preventDefault();
            //event.stopPropagation();
        }, true);

        $ul.get(0).addEventListener('mouseleave', function(event) {
            var $target = $(event.target);
            //.closest('.crsa-cm-edit');

            if($target.is('.crsa-cm-edit')) {
                //sws//$.fn.crsa('highlightElement', null);
                wfbuilder.highlightElement(null);

                //sws//
                wfbuilder.hidePreview();


                $rule_menu.detach();
                //event.preventDefault();
                //event.stopPropagation();
            } else if($target.is('.crsa-cm-code')) {

                //sws//
                wfbuilder.hidePreview();
            }

        }, true);

        $ul.get(0).addEventListener('mouseover', function(event) {
            var $target = $(event.target);

            if($target.is('.crsa-cm-code')) {
                var $li = $target.closest('div');
                var r = getRuleForDiv($li);

                if(r) {
                    var $el = $('<div/>');
                    var $pre = $('<pre/>').html(r.crsa_stylesheet.genGetSourceHtmlForRule(r)).appendTo($el);
                    $('<p>Click on <i class="fa fa-code"></i> to edit rule code.<br />Click on <span>.Selector</span> to edit rule properties.</p>').appendTo($el);
                    
                    //sws// origial:
                    // $.fn.crsa('showPreview', $li, $el, 'cm-preview', function(w) {
                    //     return getPreviewPosition(w, $li.closest('#crsa-left-plane, .panel'));
                    // });
                    //sws//
                    wfbuilder.showPreview($li, $el, 'cm-preview', function(w) {
                        return getPreviewPosition(w, $li.closest('.wfb-comp.pc-panel'));
                    });

                }
            }
            //event.preventDefault();
            //event.stopPropagation();
        }, true);

        $ul.get(0).addEventListener('mouseout', function(event) {
            var $target = $(event.target);
            //.closest('.crsa-cm-edit');

            if($target.is('.crsa-cm-code')) {

                //sws//
                wfbuilder.hidePreview();
            }

        }, true);

        var dragged_rule = null;
        var dragged_$el = null;
        var dragged_$placeholder = null;
        var dragged_insert_after_rule = null;

        //prevent drag scroll
        $main_div.parent().on('scroll', function() {
            if(dragged_$el) {
                $main_div.parent(0).scrollLeft(0);
            }
        });

        $ul.get(0).addEventListener('dragstart', function(event) {
            var $target = $(event.target);

            if($target.is('.crsa-cm-edit')) {
                console.log('up');

                dragged_rule = getRuleForDiv($target);
                dragged_$el = $target;

            } else if($target.is('.crsa-cm-media')) {
                dragged_$el = $target;
            }
            setTimeout(function() {
                dragged_$el.css('opacity', 0.4).hide();
            }, 100);

            //sws//
            wfbuilder.hidePreview();

        }, true);

        $ul.get(0).addEventListener('dragenter', function(event) {
            var $target = $(event.target);

            if($target.closest('.crsa-cm-edit, .crsa-cm-media').length) {
                //console.log('enter');
                event.dataTransfer.dropEffect = 'move';
            }
        }, true);

        var getPreviousRule = function($el) {
            var $prev = $el.prev();
            if($prev.length) {
                if($prev.is('.crsa-cm-edit')) {
                    return getRuleForDiv($prev);

                } else if($prev.is('.crsa-cm-media')) {
                    var $last = $prev.find('.crsa-cm-edit').last();
                    if($last.length) {
                        return getRuleForDiv($last);
                    } else {
                        //should not happen
                    }
                }
            } else {
                var $media = $el.parent().closest('.crsa-cm-media');
                if($media.length) {
                    return getPreviousRule($media);
                }
                return 'first';
            }
        }

        $ul.get(0).addEventListener('dragover', function(event) {
            var $target = $(event.target);

            if($target.is('.crsa-cm-placeholder')) {
                var $p = $target.closest('.crsa-cm-media');
                if($p.is('.crsa-cm-media') && $target.index() == $p.find('>div').children().length - 1) {

                    if(event.offsetX < 25) {
                        dragged_$placeholder.insertAfter($p);
                        //dragged_insert_after_rule = getRuleForDiv($p.find('.crsa-cm-edit').last());
                    } else {
                        dragged_$placeholder.appendTo($p.find('>div'));
                        //dragged_insert_after_rule = getRuleForDiv($p.find('.crsa-cm-edit').last());
                    }
                }
            } else if($target.closest('.crsa-cm-edit').length) {
                //    console.log('over');
                $target = $target.closest('.crsa-cm-edit');

                if($target.get(0) != dragged_$el.get(0)) {
                    if(!dragged_$placeholder) {
                        dragged_$placeholder = $('<div class="crsa-cm-placeholder"></div>');
                    }
                    var h = $target.height();
                    if(event.offsetY < h/2) {
                        dragged_$placeholder.insertBefore($target);
                        dragged_insert_after_rule = getPreviousRule($target);
                    } else {
                        dragged_$placeholder.insertAfter($target);
                        dragged_insert_after_rule = getRuleForDiv($target);
                    }
                }
                //console.log(event);
            } else if($target.is('p.media-query')) {
                if(!dragged_$placeholder) {
                    dragged_$placeholder = $('<div class="crsa-cm-placeholder"></div>');
                }
                var h = $target.height();
                var $media = $target.parent();
                if(event.offsetY < h/2) {
                    dragged_$placeholder.insertBefore($media);
                    dragged_insert_after_rule = getPreviousRule($media);
                } else {
                    dragged_$placeholder.prependTo($media.find('>div'));
                    var $first = $media.find('.crsa-cm-edit').first();
                    dragged_insert_after_rule = getRuleForDiv($first);
                }

            }
            event.preventDefault();
        }, true);

        $ul.get(0).addEventListener('dragleave', function(event) {
            var $target = $(event.target);

            if($target.closest('.crsa-cm-placeholder').length) {
                //if(dragged_$placeholder) dragged_$placeholder.detach();
            } else if($target.closest('.crsa-cm-edit, .crsa-cm-media').length) {
                //if(dragged_$placeholder) dragged_$placeholder.detach();
            }
        }, true);

        $ul.get(0).addEventListener('dragend', function(event) {
            var $target = $(event.target);


            if($target.closest('.crsa-cm-edit, .crsa-cm-media').length) {
                console.log('end');
                //console.log(dragged_insert_after_rule);

                if(dragged_$el) {
                    dragged_$el.css('opacity', 1.0);
                }
                if(dragged_$placeholder) {
                    var $prev = dragged_$placeholder.prev();
                    var rule = null;
                    var media = null;
                    //console.log($prev);
                    if($prev.length == 0) {
                        rule = 'first';
                    } else {
                        if($prev.is('.crsa-cm-edit')) {
                            rule = getRuleForDiv($prev);
                        } else if($prev.is('.crsa-cm-media')) {
                            var $last = $prev.find('.crsa-cm-edit').last();
                            rule = getRuleForDiv($last);
                        } else if($prev.is('i')) {
                            rule = getPreviousRule($prev.closest('.crsa-cm-media'));
                        }
                    }
                    var $media = dragged_$placeholder.closest('.crsa-cm-media');
                    if($media.length) {
                        media = $media.attr('data-media').replace(/###/g, '"');
                        if(rule == 'first') {
                            $prev = $media.prev();

                            if($prev.is('.crsa-cm-edit')) {
                                rule = getRuleForDiv($prev);

                            } else if($prev.is('.crsa-cm-media')) {
                                var $last = $prev.find('.crsa-cm-edit').last();
                                if($last.length) {
                                    rule = getRuleForDiv($last);
                                }
                            }
                        }
                    } else {
                        //media = dragged_rule.media;
                    }
                    //console.log(rule);
                    //console.log(media);

                    if(!media && dragged_$el.is('.crsa-cm-media')) {
                        media = dragged_$el.attr('data-media').replace(/###/g, '"');
                    }

                    var source_rule = dragged_rule;
                    var dest_cs = dragged_$placeholder.closest('li.crsa-stylesheet').data('cs');

                    var moved_rules = [];

                    if(dragged_rule) {
                        moved_rules.push(dragged_rule);
                    }

                    if(dragged_$el.is('.crsa-cm-media')) {
                        dragged_$el.find('.crsa-cm-edit').each(function(i, li) {
                            moved_rules.push(getRuleForDiv($(li), original_cs));
                        });
                    }

                    var original_cs = moved_rules[0].crsa_stylesheet;

                    var rules = original_cs.getAllRules();
                    var dest_idx = typeof rule == 'string' ? 0 : rule.index + 1;
                    var idx = rules.indexOf(moved_rules[0]);
                    if(idx >= 0) {
                        rules.splice(idx, moved_rules.length);
                        if(original_cs == dest_cs) {
                            if(dest_idx > idx) dest_idx -= moved_rules.length;
                        }
                    }
                    var dest_rules = dest_cs.getAllRules();
                    for(var i = 0; i < moved_rules.length; i++) {
                        moved_rules[i].media = media;
                        moved_rules[i].crsa_stylesheet = dest_cs;
                        dest_rules.splice(dest_idx + i, 0, moved_rules[i]);
                    }

                    for(var i = 0; i < dest_rules.length; i++) {
                        dest_rules[i].index = i;
                    }
                    //dragged_$placeholder.replaceWith(dragged_$el);
                    //dragged_$el.show();

                    dest_cs.genForgetCachedSource();
                    dest_cs.genRegenerateAndSetCssSource(function() {

                        if(original_cs != dest_cs) {
                            for(var i = 0; i < rules.length; i++) {
                                rules[i].index = i;
                            }
                            original_cs.genForgetCachedSource();
                            original_cs.genRegenerateAndSetCssSource(function() {
                                $('body').trigger('crsa-rules-changed', {list: [dest_cs, original_cs]});
                            });
                        } else {
                            $('body').trigger('crsa-rules-changed', {list: [dest_cs]});
                        }
                    });
                }
            }
            dragged_$el = null;
            dragged_rule = null;
            if(dragged_$placeholder) dragged_$placeholder.remove();
            dragged_$placeholder = null;
            //dragged_insert_after_rule = null;

        }, true);

        $ul.get(0).addEventListener('drop', function(event) {
            var $target = $(event.target);

            if($target.closest('.crsa-cm-edit').length) {

            }
            event.stopPropagation();
        }, true);


        var list = [];

        var exists = false;

        var filterList = function(rules) {
            var norm_filter = filter ? normalizeSelector(filter) : null;
            exists = false;

            if(!norm_filter && !onlyClasses) return rules;
            var list = [];
            $.each(rules, function(i,r) {
                if(onlyClasses && r.type != 'class') return true;
                if(!filter || (r.selector && r.crsa_stylesheet.getSelector(r).indexOf(norm_filter) >= 0) || (r.raw && r.raw.indexOf(filter) >= 0)) {
                    list.push(r);
                    if(r.type == 'class' && r.class === filter) {
                        exists = true;
                    }
                }
            });
            return list;
        }

        var current_rule_index = -1;

        var updateRulesORIGINAL = function() {

            var profile = new CrsaProfile(true);

            $ul.html('');

            if(!selectedPage) return;

            var ref_rules_dir = null

            if($refElement) {
                var node = $refElement.get(0);
                if(node.ownerDocument.defaultView && node.ownerDocument.defaultView.getMatchedCSSRules) {
                    var rules = node.ownerDocument.defaultView.getMatchedCSSRules(node, '');
                    ref_rules_dir = {};
                    if(rules) {
                        var i = rules.length;
                        while (i--) {
                            ref_rules_dir[rules[i].selectorText] = true;
                        }
                    }
                }
            }
            var cp = getCrsaPageStylesForPage(selectedPage);
            var crsaPage = getCrsaPageForIframe(selectedPage);

            if(!cp) return;

            shown_cs_list = [];

            $.each(cp.getAllCrsaStylesheets(), function(j, cs) {

                //  if(filter_cs_list.indexOf(cs) >= 0) return true;

                if(cs.ignore) return true;

                shown_cs_list.push(cs);

                var list = filterList(cs.getAllRules());

                var $li = $('<li/>', {class: 'crsa-stylesheet'}).appendTo($ul).html('<div><h3 class="crsa-cm-cs">' + cs.name + '</h3></div>').data('cs', cs);
                var type = cs.genGetType();
                if(type != 'css') {
                    var $tt = $('<span class="cs-type">' + type + '</span>');
                    $tt.tooltip({container: 'body', placement: 'auto top', title: 'This stylesheet uses ' + type.toUpperCase() + ' parser.', trigger: 'hover'});

                    $li.find('h3').append($tt);
                }
                var $a = $('<a/>', {class: 'cm-sslist-addrule', href:"#"}).html('+ Add rule').appendTo($li.find('>div'));
                $a.on('click', function(e) {
                    e.preventDefault();
                    showAddRuleBox($a, cs, filter);
                });

                var error = cs.genGetError();
                if(error) {
                    var extract = (error.extract ? error.extract.join("\n") : '');
                    if(extract.length > 80) extract = extract.substr(0, 80);
                    var info = '<div class="cm-error">Line ' + error.line + ', ' + error + '<pre>' + extract + '</pre></div>';
                    var $lert = $('<div class="alert alert-info">Stylesheet has one or more LESS syntax errors (use <b>Page -&gt; Edit code</b> to fix it): ' + info + '</div>').appendTo($li.find('>div'));
                }

                $ul = $("<ul/>").appendTo($li);

                var last_media = null;

                if(list.length > 0) {

                    $.each(list, function(i,r) {
                        var media = r.media ? r.media : null;

                        if(last_media != media) {
                            if(last_media) {
                                $ul = $ul.parent().closest('ul');
                            }
                            if(media) {

                                var $li = $('<li/>', {class: 'crsa-cm-media'}).appendTo($ul).html('<div class="media-query">' + crsaPage.describeMediaQuery(media) + '</div>').data('media', media);
                                $('<i/>', {'class' : 'fa fa-bars crsa-cm-move'}).appendTo($li.find('> div'));
                                $ul = $("<ul/>").appendTo($li);
                            }
                        }
                        last_media = media;
                        var $li = $('<li/>', {class: 'mjs-nestedSortable-no-nesting'}).appendTo($ul).data('rule', r);

                        var $name;
                        var $div = $('<div class="rule"></div>').appendTo($li);
                        if(r.selector) {
                            if(r.class) {
                                $('<i/>', {'class' : 'fa fa-plus crsa-cm-apply'}).appendTo($div);
                            }
                            $name = $('<a/>', {'class' : 'crsa-cm-edit', href : '#'}).text(r.selector).appendTo($div);
                            //var $edit = $('<a/>', {'class' : 'crsa-cm-edit', href : '#'}).text('edit').appendTo($div);
                        } else if(r.raw) {
                            $name = $('<a/>', {'class' : 'crsa-cm-edit', href : '#'}).text(shortenString(r.raw, 18)).appendTo($div);
                            if(r.less_type && r.less_type == 'Comment') $name.addClass('crsa-cm-name-comment');
                        }
                        // var $ss = $('<a/>', {'class' : 'crsa-cm-tylesheet', href : '#'}).text(r.crsa_stylesheet.name).appendTo($name);
                        var $remove = $('<i/>', {'class' : 'fa fa-trash-o crsa-cm-remove'}).appendTo($div);
                        var $code = $('<i/>', {'class' : 'fa fa-code crsa-cm-code'}).appendTo($div);
                        $('<i/>', {'class' : 'fa fa-bars crsa-cm-move'}).appendTo($div);
                        //var $move = $('<a/>', {'class' : 'crsa-cm-move', href : '#'}).html('move').appendTo($li);

                        /*
                         if($refElement) {
                         if(ref_rules_dir != null) {
                         if(r.selector && r.selector in ref_rules_dir) {
                         $li.addClass('crsa-cm-has-rule');
                         }
                         } else {
                         try {
                         if(r.selector && $refElement.is(r.selector)) {
                         $li.addClass('crsa-cm-has-rule');
                         }
                         }
                         catch(err) {}
                         }
                         }*/
                    });
                    if(last_media) {
                        $ul = $ul.parent().closest('ul');
                    }
                } else {
                    if(filter) {
                        $('<li><div class="alert alert-info">No rules found.</div></li>').appendTo($ul);
                    }
                }

                //add new
                /*  var $li = $('<li/>').appendTo($ul).html('<div class="crsa-cm-add"></div>');
                 var $div = $li.find('>div');
                 var $input = $('<input/>', {'class' : 'crsa-cm-input form-control filter-form', placeholder: '.new-css-rule'}).appendTo($div);
                 var $new = $('<button/>', {'class' : 'btn btn-link crsa-cm-new'}).html("+ Add").appendTo($div);

                 */

                $ul = $ul.parent().closest('ul');
            });

            profile.show('paint css 1');

            $ul.find('.crsa-cm-apply').on('click', function(event) {
                var $li = $(event.delegateTarget).closest('li');
                var r = $li.data('rule');
                var se = service.getSelectedElement();
                if(!se || se.type != 'element') return;

                if(r.classes) {
                    if(r.classes.length == 1) {
                        if(se.data.hasClass(r.class)) {
                            $dest.trigger('crsa-cm-class-remove', r.class);
                        } else {
                            $dest.trigger('crsa-cm-class-add', r.class);
                        }
                    } else {
                        var $ul = $li.data('assign-menu');
                        if($ul && $ul.is(':visible')) {
                            $ul.remove();
                        } else {
                            var $menu_ul = showContextMenuForRule($li, true);
                            $li.data('assign-menu', $menu_ul);
                        }
                    }
                }
                return false;
            });//.tooltip({container: 'body', placement: 'top', title: 'Add / remove this class from the selected element.', trigger: 'hover'});

            profile.show('paint css 2');

            $ul.find('.crsa-cm-edit')
                .on('click', function(event) {
                    var $li = $(event.delegateTarget).closest('li');
                    var r = $li.data('rule');
                    if(r.selector) {
                        _this.editRule(r);
                    } else {
                        editRuleSource(r);
                    }
                    event.preventDefault();
                })
                .on('mouseover', function(e) {
                    var $li = $(e.delegateTarget).closest('li');
                    var r = $li.data('rule');
                    if(r && r.selector) {
                        try {
                            var $els = $(getIframeBody(selectedPage.get(0))).find(r.selector);
                            $.fn.crsa('highlightElement', $els);
                        } catch(err) {
                            //console.log(err);
                        }
                    }
                })
                .on('mouseout', function(e) {
                    $.fn.crsa('highlightElement', null);
                });

            $ul.find('div.rule')
                .on('contextmenu', function(event) {
                    event.preventDefault();
                    var $li = $(event.delegateTarget).closest('li');
                    showContextMenuForRule($li, false);
                });

            $ul.find('.crsa-cm-code')
                .on('click', function(event) {
                    var $li = $(event.delegateTarget).closest('li');
                    var r = $li.data('rule');
                    editRuleSource(r);
                    event.preventDefault();
                })
                .on('mouseover', function(e) {
                    var $li = $(e.delegateTarget).closest('li');
                    var r = $li.data('rule');
                    if(r) {
                        var $el = $('<div/>');
                        var $pre = $('<pre/>').html(r.crsa_stylesheet.genGetSourceHtmlForRule(r)).appendTo($el);
                        $('<p>Click on <i class="fa fa-code"></i> to edit rule code.<br />Click on <span>.Selector</span> to edit rule properties.</p>').appendTo($el);
                    }

                    //sws// original: $.fn.crsa('showPreview', $li, $el, 'cm-preview');
                    wfbuilder.showPreview($li, $el, 'cm-preview');

                })
                .on('mouseout', function(e) {

                    //sws//
                    wfbuilder.hidePreview();
                });

            $ul.find('.crsa-cm-remove').on('click', function(event) {
                var $li = $(event.delegateTarget).closest('li');
                var r = $li.data('rule');
                var $csli = $li.closest('li.crsa-stylesheet');
                var cs = $csli.data('cs');
                var $input = $li.find('input');
                var sel = $.trim($input.val());

                getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Remove CSS rule", false, cs);

                cs.removeLessRule(r);
                cs.genRegenerateAndSetCssSource(function() {
                    $dest.trigger('crsa-cm-removed', r);
                    $body.trigger('crsa-rules-changed', {list: [cs]});
                });
                event.preventDefault();
            });

            if(filter) {
                $ul.find('a.crsa-cm-move').hide();
            } else {
                $ul.find('a.crsa-cm-move').show();
            }

            profile.show('paint css 3');

            //$ul.sortable( "refresh" );
            //$ul.find('ul').addBack().nestedSortable('refresh');
        };


        var getRuleForDiv = function($div, cs) {
            var i = parseInt($div.attr('data-rule-index'));
            if(!cs) cs = $div.closest('li.crsa-stylesheet').data('cs');
            return cs.getRuleByIndex(i);
        }

        var getRuleForDivFast = function(div, cs) {
            var i = parseInt(div.getAttribute('data-rule-index'));
            return cs.getRuleByIndex(i);
        }

        var updateRules = function() {
            var profile = new CrsaProfile(true);

            //$ul.get(0).innerHTML = '';

            $ul.html('');

            /*
            var p = $ul.get(0).parentElement;

            p.removeChild($ul.get(0));

            $ul = $('<ul/>');
            p.appendChild($ul.get(0));
            */

            /*
            var $new;
            $ul.replaceWith(function () {
                $new = $('<ul/>');
                return $new;
            });
            $ul = $new;
            */

            profile.show('clean');

            shown_cs_list = [];

            if(!selectedPage) return;

            var ref_rules_dir = null

            if($refElement) {
                var node = $refElement.get(0);
                if(node.ownerDocument.defaultView && node.ownerDocument.defaultView.getMatchedCSSRules) {
                    var rules = node.ownerDocument.defaultView.getMatchedCSSRules(node, '');
                    ref_rules_dir = {};
                    if(rules) {
                        var i = rules.length;
                        while (i--) {
                            ref_rules_dir[rules[i].selectorText] = true;
                        }
                    }
                }
            }
            var cp = getCrsaPageStylesForPage(selectedPage);
            var crsaPage = getCrsaPageForIframe(selectedPage);

            if(!cp) return;

            $.each(cp.getAllCrsaStylesheets(), function(j, cs) {

                //  if(filter_cs_list.indexOf(cs) >= 0) return true;

                if(cs.ignore) return true;

                shown_cs_list.push(cs);

                var list = filterList(cs.getAllRules());

                var $li = $('<li/>', {class: 'crsa-stylesheet'}).appendTo($ul).html('<div class="cs-head"><h3 class="crsa-cm-cs">' + cs.name + '</h3></div>').data('cs', cs);
                var type = cs.genGetType();
                if(type != 'css') {
                    var $tt = $('<span class="cs-type">' + type + '</span>');
                    $tt.tooltip({container: 'body', placement: 'auto top', title: 'This stylesheet uses ' + type.toUpperCase() + ' parser.', trigger: 'hover'});

                    $li.find('h3').append($tt);
                }
                var $a = $('<a/>', {class: 'cm-sslist-addrule', href:"#"}).html('+ Add rule').appendTo($li.find('>div'));
                $a.on('click', function(e) {
                    e.preventDefault();
                    showAddRuleBox($a, cs, filter);
                });

                var error = cs.genGetError();
                if(error) {
                    var extract = (error.extract ? error.extract.join("\n") : '');
                    if(extract.length > 80) extract = extract.substr(0, 80);
                    var info = '<div class="cm-error">Line ' + error.line + ', ' + error + '<pre>' + extract + '</pre></div>';
                    var $lert = $('<div class="alert alert-info">Stylesheet has one or more LESS syntax errors (use <b>Page -&gt; Edit code</b> to fix it): ' + info + '</div>').appendTo($li.find('>div'));
                }

                //$ul = $("<ul/>").appendTo($li);

                var $spacer = $("<div/>", {class: 'cs-head-spacer'}).appendTo($li).html('<h3 class="crsa-cm-cs">' + cs.name + '</h3>');

                $ul = $("<div/>", {class: 'rule-list'}).appendTo($li);


                var last_media = null;

                var html = '';

                if(list.length > 0) {

                    $.each(list, function(i,r) {
                        var media = r.media ? r.media : null;

                        if(last_media != media) {
                            if(last_media) {
                                html += '</div></div>';
                            }
                            if(media) {

                                var li = '<div class="crsa-cm-media" draggable="true" data-media="' + media.replace(/"/g, '###') + '"><p class="media-query">' + crsaPage.describeMediaQuery(media) + '</p><i class="fa fa-bars crsa-cm-move"></i><div>';
                                //--).data('media', media);
                                html += li;
                            }
                        }
                        last_media = media;
                        var div = '';
                        var name = '';

                        if(r.selector) {
                            if(r.class) {
                                div = '<i class="fa fa-plus crsa-cm-apply"></i>';
                            }
                            //div += '<a class="crsa-cm-edit" href="#">' + r.selector + '</a>';
                            div += r.selector;
                        } else if(r.raw) {
                            //div += '<a class="crsa-cm-edit' + (r.less_type && r.less_type == 'Comment' ? ' crsa-cm-name-comment' : '') + '" href="#">' + shortenString(r.raw, 18) + '</a>';
                            div += '<span class="' + (r.less_type && r.less_type == 'Comment' ? ' crsa-cm-name-comment' : '') + '" >' + shortenString(r.raw, 18) + '</span>';
                        }
                        //div += '<i class="crsa-cm-apply">app</i><i class="crsa-cm-remove">del</i><i class="crsa-cm-code">cod</i><i class="crsa-cm-move">mov</i>';
                        //div += '<i class="fa fa-trash-o crsa-cm-remove"></i><i class="fa fa-code crsa-cm-code"></i><i class="fa fa-bars crsa-cm-move"></i>';

                        //html += '<li class="mjs-nestedSortable-no-nesting"><div class="rule">' + div + '</div></li>';

                        html += '<div class="crsa-cm-edit mjs-nestedSortable-no-nesting" data-rule-index="' + r.index + '" draggable="true">' + div + '</div>';

                        //--li.data('rule', r);

                    });
                    if(last_media) {
                        html += '</div></div>';
                    }
                } else {
                    if(filter) {
                        html += '<li><div class="alert alert-info">No rules found.</div></li>';
                    }
                }
                $ul.html(html);
                $ul = $ul.parent().closest('ul');
            });

            profile.show('paint css 1');

            if(filter) {
                $ul.find('a.crsa-cm-move').hide();
            } else {
                $ul.find('a.crsa-cm-move').show();
            }


            profile.show('paint css 3');

            //$ul.sortable( "refresh" );
            //$ul.find('ul').addBack().nestedSortable('refresh');

            scroll_$heads = $ul.find('.cs-head');
            $ul.trigger('scroll');
        };


        var showContextMenuForRule = function($li, only_classes) {
            var r = getRuleForDiv($li);

            var $menu = new CrsaContextMenu();

            if(!only_classes) {
                if(r.selector) {
                    $menu.add("Edit...", null, function() {
                        _this.editRule(r);
                    });
                }
                $menu.add("Edit code...", null, function() {
                    editRuleSource(r);
                });
            }

            var se = service.getSelectedElement();

            if(se && se.type != 'element') {
                se = null;
            }
            if(r.classes) {
                if(!only_classes) {
                    $menu.add("", null, null, 'divider');
                }
                if(se) {
                    $menu.add("Assign class to <b>" + getElementName(se.data) + "</b>", null, null, 'header');

                    var remove = [];
                    $.each(r.classes, function(i,cls) {
                        cls = cls.replace('.','');
                        if(se.data.hasClass(cls)) {
                            remove.push(cls);
                        }
                        (function(cls) {
                            $menu.add('+ ' + cls, null, function() {
                                $dest.trigger('crsa-cm-class-add', cls);
                            });
                        })(cls);
                    })

                    var all = se.data.attr('class').split(/\s+/);
                    var other = [];
                    if(all) {
                        $.each(all, function(i, cls) {
                            if(remove.indexOf(cls) < 0) {
                                other.push(cls);
                            }
                        });
                    }

                    if(remove.length > 0 || other.length > 0) {
                        $menu.add("", null, null, 'divider');
                        $menu.add("Remove class from <b>" + getElementName(se.data) + "</b>", null, null, 'header');
                        $.each(remove, function(i,cls) {
                            (function(cls) {
                                $menu.add('- ' + cls, null, function() {
                                    $dest.trigger('crsa-cm-class-remove', cls);
                                });
                            })(cls);
                        })
                        $.each(other, function(i,cls) {
                            if(cls.indexOf('crsa-') != 0) {
                                (function(cls) {
                                    $menu.add('- ' + cls, null, function() {
                                        $dest.trigger('crsa-cm-class-remove', cls);
                                    });
                                })(cls);
                            }
                        })
                    }
                } else {
                    $menu.add("Select element first, then assign class to it.", null, null, 'header');
                }

            }
            var $menu_ul = $menu.showAt(event.pageX, event.pageY, $li.closest('.crsa-cm-rules'));
            return $menu_ul;
        }
        /*
        this.updateSingleRule = function(rule) {
            $ul.find('li').each(function(i,li) {
                var $li = $(li);
                var r = $li.data('rule');
            })
        }
        */

        this.editRule = function(r) {
            current_rule_index = r.crsa_stylesheet.crsa_rules.indexOf(r);
            //$dest.trigger('crsa-cm-edit', r);
            var rule_obj = getObjectFromRule(r);

            //sws//!!!
            wfbuilder.showProperties(rule_obj, $props_div);


            var $back = $main_div.find('button.back');
            if($back.length == 0) {
                $back = $('<button/>', {class: "btn back"}).html("<i class=\"fa fa-arrow-left\"></i>&nbsp;Back to rules").prependTo($props_div.parent());

                $back.on('click', function(e) {
                    _this.refresh();
                    _this.showListPanel(true);
                    e.preventDefault();
                });
            }

            //sws//original -300
            $main_div.animate(
                {left: -278}, 150, function() {
                });
        }

        this.showListPanel = function(animated) {
            if(animated) {
                $main_div.animate(
                    {left: 0}, 150, function() {
                    });
            } else {
                $main_div.css('left', 0);
            }
        }

        this.reloadStylesheet = function(cs, done) {
            var onDone = function() {
                if(done) done();
                crsaQuickMessage(cs.name + " reloaded.");
                $('body').trigger('crsa-stylesheets-changed');
            }

            if(cs.changed) {
                showAlert(cs.name + " has unsaved changes. Do you want to reload the stylesheet and loose these changes?", "Unsaved changes", "Cancel", "Reload", null, function() {
                    cs.reload(onDone);
                });
            } else {
                cs.reload(onDone);
            }
        }

        var showAddRuleBox = function($el, cs, value) {

            if(cs.genGetError()) {
                showAlert(cs.name + ' has syntax errors. Fix the errors before adding new rules.', 'Notice');
                return;
            }
            var offset = $el.offset();
            var place = offset.left > $(window).width()/2 ? 'left' : 'right';
            var eid = getUniqueId();
            if($el.data('popover-active')) {
                $el.popover('destroy');
                $el.data('popover-active', null);
                return;
            }
            var ensureRemove = function($e) {
                setTimeout(function() {
                    $e.closest('.popover').remove();
                }, 750);
            }

            var pop = $el.popover({
                html: true,
                placement: place,
                trigger: 'manual',
                title: 'Add new CSS rule',
                container: 'body',
                content: '<form id="' + eid + '"><div class="form-group"><input class="form-control" placeholder=".any-css-selector" style="margin-bottom:8px;"/><p class="help-block"></p></p><button class="ok btn">Create</button><button class="ok assign btn btn-link">Create & Assign class</button><button class="closeit btn btn-link">Cancel</button></div></form>'
            })
                .on('shown.bs.popover', function() {
                    var $d = $('#' + eid);
                    var $i = $d.find('input').focus();
                    if(value) $i.val(value);
                    var $form = $d;
                    var $b = $d.find('button.ok');
                    var $a = $d.find('button.assign').css('visibility', 'hidden');
                    var $help = $d.find('p.help-block').hide();
                   // $a.tooltip({container: 'body', placement: 'bottom', title: 'Create the class and assign it to the selected element.', trigger: 'hover'});
                    var $bc = $d.find('button.closeit');

                    
                    $i.on('input', function() {
                        if(getClassFromSelector($i.val())) {
                            $a.css('visibility', 'visible');
                        } else {
                            $a.css('visibility', 'hidden');
                        }
                    });
                    

                    if(!$refElement) {
                        $a.hide();
                    }

                    var doAdd = function(e) {

                        var r = $.trim($i.val());
                        if(!r || r.length == 0) {
                            $d.addClass('has-error');
                            return;
                        }

                        if($(e.delegateTarget).hasClass('assign')) {
                            if(!getClassFromSelector(r)) {
                                $help.html(r + ' is not a class selector. You can only assign classes (for example .BUTTON) to elements.').show();
                                $d.addClass('has-error');
                                return;
                            }
                        }


                        //sws//block:
                        //getCrsaPageForIframe(wfbuilder.getSelectedPage().$iframe).undoStack.add("Add CSS rule / " + r, false, cs);

                        
                        cs.addLessRule(r, {});
                        cs.genRegenerateAndSetCssSource(function() {
                            $('body').trigger('crsa-rules-changed', {list: [cs]});
                            var r = cs.crsa_rules.length > 0 ? cs.crsa_rules[cs.crsa_rules.length-1] : null;
                            if(r) {
                                if($(e.delegateTarget).hasClass('assign') && $refElement && r.class && !$refElement.hasClass(r.class)) {

                                    $dest.trigger('crsa-cm-class-add', r.class);
                                    updateUsedClasses();
                                }
                                _this.editRule(r);
                            }

                        });
                       // $a.tooltip('destroy');
                        $el.popover('hide');
                        ensureRemove($d);
                    }

                    $form.on('submit', function(e) {
                        e.preventDefault();
                        doAdd(e);
                    });
                    $b.on('click', function(e) {
                        e.preventDefault();
                        doAdd(e);
                    });

                    $bc.on('click', function(e) {
                       // $a.tooltip('destroy');
                        $el.popover('hide');
                        e.preventDefault();
                        ensureRemove($d);
                    });
                })
                .on('hidden.bs.popover', function() {
                    setTimeout(function() {
                        $el.popover('destroy').data('popover-active', null);
                    },10);
                });
           $el.popover('show').data('popover-active', true);
        }

        var updateUsedClasses = function() {
            var p = new CrsaProfile(false);

            var script_tag = false;

            if($refElement) {
                var pgel = getElementPgNode($refElement);
                script_tag = pgel && pgel.script_info;
            }

            if(!$refElement || script_tag) {
                
                $ul.find('.crsa-cm-apply').hide();
                $ul.find('div.crsa-cm-has-rule').removeClass('crsa-cm-has-rule');
                //return;
            } else {
                
                $ul.find('.crsa-cm-apply').show();
            }
            p.show('    - 1');


            if(!selectedPage) return;

            var media_vis_cache = {};
            var crsaPage = getCrsaPageForIframe(selectedPage);

            if(!crsaPage) return;

            // sws: blocked
            // var win = crsaPage.getWindow();
            var win = crsaPage.parentWindow;

            if($refElement) {
                var ref_rules_dir = null

                var node = $refElement.get(0);
                if(node.ownerDocument.defaultView && node.ownerDocument.defaultView.getMatchedCSSRules) {
                    var rules = node.ownerDocument.defaultView.getMatchedCSSRules(node, '');
                    ref_rules_dir = {};
                    if(rules) {
                        var i = rules.length;
                        while (i--) {
                            ref_rules_dir[normalizeSelector(rules[i].selectorText)] = true;
                        }
                    }
                }

                $ul.find('.crsa-stylesheet').each(function(i, ul) {
                    var $ul = $(ul);
                    var cs = $ul.data('cs');
                    $ul.find('div.crsa-cm-edit').each(function(i,li) {

                        var hide = false;

                        var rule = getRuleForDivFast(li, cs);
                        if(rule == null || !rule.selector) {
                            if(rule) {
                                hide = only_active;
                                li.className = 'crsa-cm-edit' + (only_active ? ' hide-rule' : '');
                            }
                            return true;
                        }

                        var sel = rule.selector;
                        var has = false;

                        if(ref_rules_dir) {
                            if(li.crsaNormalizedSelector) {
                                sel = li.crsaNormalizedSelector;
                            } else {
                                sel = normalizeSelector(sel);
                                li.crsaNormalizedSelector = sel;
                            }
                            if(sel && sel in ref_rules_dir) {
                                li.className = 'crsa-cm-edit crsa-cm-has-rule';
                                has = true;
                            } else {
                                hide = only_active;
                                li.className = 'crsa-cm-edit' + (only_active ? ' hide-rule' : '');
                            }
                        } else {
                            try {
                                if(sel && $refElement.is(sel)) {
                                    li.className = 'crsa-cm-edit crsa-cm-has-rule';
                                    has = true;
                                } else {
                                    hide = only_active;
                                    li.className = 'crsa-cm-edit' + (only_active ? ' hide-rule' : '');
                                }
                            } catch(err) {
                                hide = only_active;
                                li.className = 'crsa-cm-edit' + (only_active ? ' hide-rule' : '');
                            }
                        }

                        if(hide) {
                            li.className = 'crsa-cm-edit hide-rule';
                        }

                        if(rule.class) {
                            var cls = 'fa fa-plus crsa-cm-apply';
                            if(has) {
                                cls = 'fa fa-minus crsa-cm-apply';
                            } else {

                            }
                            var ii = li.childNodes[0];
                            if(cls != ii.className) {
                                ii.className = cls;
                            }
                        }
                    });
                });
            }
            p.show('    - 2');

            $ul.find('.crsa-cm-media').each(function(i,li) {
                var $li = $(li);
                var media = $li.attr('data-media').replace(/###/g, '"');

                if(media && only_visible) {
                    if(!(media in media_vis_cache)) {
                        media_vis_cache[media] = win.matchMedia(media).matches;
                    }
                    if(!media_vis_cache[media]) {
                        $li.addClass('hide-rule');
                        return true;
                    }

                }
                if($li.find('.crsa-cm-edit').not('.hide-rule').length == 0) {
                    $li.addClass('hide-rule');
                } else {
                    $li.removeClass('hide-rule');
                }
            });

            p.show('    - 3');
        }

        updateRules();

        /*
        $ul.nestedSortable({
            forcePlaceholderSize: true,
            helper:	'clone',
            placeholder: 'tree-placeholder',
            handle: 'div > i.fa-bars, h3',
            tabSize: 20,
            protectRoot: true,
            tolerance: 'pointer',
            scroll: false,
            aacontainer: '.crsa-cm-rules',
            axis: "y",
            isTree : true,
            items: 'div.crsa-cm-edit',
            listType: 'ul',
            toleranceElement: '> div',
            isAllowed: function(placeholder, placeholderParent, originalItem) {
                //return true;
                if(filter) return false;
                if(originalItem.data('cs')) return false;
                if(!placeholderParent) return false;
                if(placeholderParent.data('cs')) {
                    return true;
                } else if(placeholderParent.data('media')) {
                    if(originalItem.data('media')) return false;
                } else if(placeholderParent.data('rule')) {
                    return false;
                }
                return true;
            }
        })
            .on("sortstart", function() {
                if(filter) {
                    showAlert("Can't sort rules while search filter is active. Something bad could happen...", "Ups, this is unpredictable");
                }
            })
            .on("sortupdate", function(event, ui) {
                var new_rules = [];

                getCrsaPageForIframe(wfbuilder.getSelectedPage()).undoStack.add("Reorder CSS rules");

                $ul.find('li').each(function(i,e) {
                    var $li = $(e);
                    var rule = $li.data('rule');
                    if(rule) {
                        rule.media = $li.parent().parent().data('media');
                        rule.crsa_stylesheet = $li.closest('li.crsa-stylesheet').data('cs');
                        new_rules.push(rule);
                    }
                });
                getCrsaPageStylesForPage(selectedPage).reorderRules(shown_cs_list, new_rules, function() {

                    $('body').trigger('crsa-rules-changed');

                    //setUndoPointForCss();
                });
                //console.log(less_source);


                //rules = methods.findAll.call( _this, onlyClasses);
                //updateRules();
            });

        */
        updateUsedClasses();

        var search_timeout = null;

        $input.on('input', function(event) {
            filter = $input.val();
            if(filter && filter.length == 0) filter = null;
            if(search_timeout) {
                clearTimeout(search_timeout);
            }
            search_timeout = setTimeout(function() {
                updateRules();
                search_timeout = null;
            }, 300);
        });

        $body.on('crsa-rules-changed', function(event) {
            //rules = methods.findAll.call( _this, onlyClasses);
            var rules = getCrsaPageStylesForPage(selectedPage).getAllActiveRules();
            updateRules();
            updateUsedClasses();
        });

        $body.on('crsa-element-selected', function(event, obj) {
            if(obj && obj.type == 'element') {
                var $el = obj.data;
                _this.setReferenceElement($el);
            } else if(obj == null) {
                _this.setReferenceElement(null);
            }
        });

    }

    window.CrsaClassManager = CrsaClassManager;

       /*
        var cs = new CrsaStylesheet();
        cs.loaded_type = 'css';
        cs.genSetSource('@import url(app.css);', function() {
            console.log(cs.crsa_rules);
            var css = cs.genGetSourceForRules();
            console.log(css);
            cs.getCssSource(function(css) {
                console.log(css);
            })
        });
        return;
        */

})( jQuery );
