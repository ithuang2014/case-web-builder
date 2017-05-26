
var Service = function() {
    
    var components = {};
    var frameworks = {};

    var framework_urls = [];

    var current_project = null;

    var self = this;

    self.projectTemplates = [];
    self.sourceParser = true;
    self.httpServer = null;
    self.bs_framesrc_url = "frameworks/bootstrap3.3.7/templates/index.html";

    var ignore_clicks = false;

    var current_project = null;

    // Set editable file types
    var editable_types = null;

    self.makeModal = function(body, title, cancel, ok) {
        if(!title) title = "Notice";
        if(!ok && !cancel) ok = "OK";

        var $d = $(comp_modals.alert);
        var $header = $d.find("modal-header");
        var $content = $d.find("modal-body");
        var $footer = $d.find("modal-footer");

        $("<h4 class=\"modal-title\">" + title + "</h4>").appendTo($header);
        $("<div>" + body + "</div>").appendTo($content);

        var footer = "";
        if(cancel) {
            footer += '<button type="button" class="btn btn-default btn-sm cancel">' + cancel + '</button>';
        }
        if(ok) {
            footer += '<button type="button" class="btn btn-primary btn-sm ok">' + ok + '</button>';
        }

        $(footer).appendTo($footer);

        return $d;
    }

    this.showQuickMessage = function(msg, duration, single, context) {
        return crsaQuickMessage(msg, duration, single, context);
    }

    this.getFormatHtmlOptions = function() {
        return {
            indent: new Array(parseInt(service.getSetting('html-indent-size', '4')) + 1).join(' ')
        }
    }

    this.isElementLocked = function(pgel, cp) {
        if(!cp) cp = this.getCrsaPageOfPgParserNode(pgel);

        return cp.callFrameworkHandler('on_is_element_locked', pgel);
    }

    this.getSelectedElement = function() {
        return wfbuilder.getSelectedElement();
    }

    var event_handlers = {};

    this.dispatchEvent = function(event, a, b, c, d, e, f) {
        
        var page = a instanceof CrsaPage ? a : null;
        
        var getHandlers = function() {
            var list = [];
            if(page) {
                for(var i = 0; i < a.frameworks.length; i++) {
                    var f = a.frameworks[i];
                    if (f.hasOwnProperty(event)) {
                        list.push(f[event]);
                    }
                }
            }
            if (event_handlers[event]) {
                list = list.concat(event_handlers[event]);
            }
            return list;
        }

        var list = getHandlers();
        
        if(event.endsWith('_async')) {
            //a = page
            //b = info/result
            //c = done
            
            if (list.length) {
                var idx = 0;

                var doEvent = function() {
                    if(idx < list.length) {
                        list[idx](a, b, function(new_b) {
                            b = new_b;
                            idx++;
                            doEvent();
                        })
                    } else {
                        if(c) c(b);
                    }
                }

                doEvent();
            } else {
                if(c) c(b)
            }
        } else {
            if(page) page.currentFrameworkHandlerReturnValues[event] = null;
            var r = null;
            if (list.length) {
                for (var i = 0; i < list.length; i++) {
                    r = list[i](a, b, c, d, e, f);
                    if(page) page.currentFrameworkHandlerReturnValues[event] = r;
                }
            }
            if(page) page.currentFrameworkHandlerReturnValues[name] = null;
            return r;
        }
    };

    this.callGlobalFrameworkHandler = function(name, a, b, c, cp) {
        if(!cp) cp = this.getSelectedPage();
        var ret = null;
        $.each(this.getFrameworks(), function(key, f) {
            if(name in f && f[name]) {
                ret = f[name](cp, a, b, c);
            }
        });
        if (event_handlers[name]) {
            event_handlers[name].forEach(function(h) {
                ret = h(name, cp, a, b, c);
            })
        }
        return ret;
    }

    this.setWorkingDir = function(dir) {
        var project = service.getCurrentProject();
        if(project) {
            project.currentWorkingDir = dir;
        }
    }

    this.getWorkingDir = function() {
        var project = service.getCurrentProject();
        if(project) return project.currentWorkingDir || project.getDir();
        var page = service.getSelectedPage();
        if(page && page.localFile) {
            return require('path').dirname(page.localFile);
        }
        return null;
    }

    this.getCurrentProject = function() {
        return current_project;
    }

    this.showAlert = function(msg, title, cancel, ok, onCancel, onOk) {
        return showAlert(msg, title, cancel, ok, onCancel, onOk);
    }
    
    self.getSetting = function(key, def) {
        key = 'settings-' + key;
        if(key in window.localStorage) {
            return window.localStorage[key];
        }
        if(typeof def == 'undefined') def = null;
        return def;
    }

    self.setIgnoreClicks = function(val) {
        ignore_clicks = val;
    }

    self.getIgnoreClicks = function() {
        return ignore_clicks;
    }

    this.getCrsaPageOfPgParserNode = function(pgel) {
        var pages = methods.getAllPages();
        for(var i = 0; i < pages.length; i++) {
            if(pages[i].sourceNode == pgel.document) return pages[i];
        }
        return null;
    }

    this.getCrsaPageById = function(id) {
        var pages = methods.getAllPages();
        for(var i = 0; i < pages.length; i++) {
            if(pages[i].uid == id) return pages[i];
        }
        return null;
    }

    this.getCrsaPageByUrl = function(url) {
        var pages = methods.getAllPages();
        var m = url.match(/pgid=([0-9]+)/);
        if(m) {
            var pageid = parseInt(m[1]);
            var cp = this.getCrsaPageById(pageid);
            if(cp) return cp;
        }
        for(var i = 0; i < pages.length; i++) {
            if(pages[i].url == url && !pages[i].live_update) return pages[i];
        }
        for(var i = 0; i < pages.length; i++) {
            if(pages[i].url == url) return pages[i];
        }
        return null;
    }

    this.addFramework = function(f, weight) {
        if(typeof weight == 'undefined') weight = 0;
        frameworks[f.key] = f;
        frameworks[f.key].order = weight;
        if(framework_urls.length > 0) {
            f.pluginUrl = framework_urls[framework_urls.length-1];
        }
        // sws: blocked
        // $('body').trigger('crsa-framework-loaded', f);
    }

    this.getFrameworks = function() {
        return frameworks;
    }

    this.getPlaceholderImage = function() {
        var path;
        if(isApp()) {
            path = this.getProxyUrl(crsaMakeUrlFromFile(crsaGetAppDir() + '/placeholders/img'));
        } else {
            path = "http://pinegrow.com/placeholders/img";
        }
        var r = Math.round(Math.random() * 8) + 1;
        return path + r + '.jpg';
    }

    this.getProxyUrl = function(url, live) {
        if(this.sourceParser && this.httpServer) {
            return this.httpServer.makeProxyUrl(url, live);
        }
        return url;
    }

    this.getMimeType = function(file) {
        return this.httpServer.getMimeType(file);
    }

    this.formatHtml = function(src) {
        return html_beautify(src, {
            'wrap_line_length': 0,
            'indent_size': parseInt(service.getSetting('html-indent-size', '4'))
        });
    }

    this.getSelectedPage = function() {
        return wfbuilder.getSelectedPage();
    }

    this.getOriginalUrl = function(url) {
        if(this.httpServer) {
            return this.httpServer.getOriginalUrl(url);
        }
        return url;
    }

    this.getFormatHtmlOptions = function() {
        return {
            indent: new Array(parseInt(self.getSetting('html-indent-size', '4')) + 1).join(' ')
        }
    }

    this.getWorkingDir = function() {
        // sws: blocked
        // var project = pinegrow.getCurrentProject();
        // if(project) return project.currentWorkingDir || project.getDir();
        var page = service.getSelectedPage();
        if(page && page.localFile) {
            return require('path').dirname(page.localFile);
        }
        return null;
    }

    this.getCurrentProject = function() {
        return current_project;
    }

    this.addTemplateProject = function(project, index) {
        if(typeof index == 'undefined' || index === null) {
            this.projectTemplates.push(project);
        } else {
            this.projectTemplates.splice(index, 0, project);
        }
        wfbuilder.addTemplateProject(project, index);
    }

    this.addTemplateProjectFromFolder = function(folder, done, index) {
        var p = new CrsaProject();
        console.log(folder);
        p.fromFolder(folder, function(p) {
            p.sortItems();
            console.log(p);
            self.addTemplateProject(p, index);
            done(p);
        })
    }

    this.isFileEditable = function(file) {
        if(editable_types === null) {
            var editable = (service.getSetting('file-types', '') || '') + ',.html,.htm';
            editable_types = [];
            editable = editable.split(',');
            // adds other editable extentions
            // service.callGlobalFrameworkHandler('on_get_editable_file_types', editable);
            $.each(editable, function(i, ext) {
                try {
                    ext = $.trim(ext);
                    if(ext.length) {
                        editable_types.push(new RegExp('\\' + ext + '$', 'i' ));
                    }
                } catch(err) {
                    console.log('File type error: ' + err);
                }
            })
        }

        for(var i = 0; i < editable_types.length; i++) {
            if(file.match(editable_types[i])) return true;
        }
        return false;
    }
}

var PgFramework = function(key, name) {
    this.key = key;
    this.name = name;
    this.show_in_action_tab = "ACT";
    this.detect = null;
    this.component_types = {};
    this.default = false;
    this.lib_sections = [];
    this.actions_sections = [];
    this.ignore_css_files = [];
    this.type = key; //default
    this.allow_single_type = false;
    this.pluginUrl = null;
    this.on_get_source = null; //function crsaPage
    this.user_lib = false;
    this.changed = false;
    this.not_main_types = false;
    this.product = null;
    this.trial = false;
    this.trial_start_message = '7 day trial was started.';
    this.trial_expired_message = 'The trial expired. Please purchase the product to continue using it.';
    this.common_sections = {};
    this.script_url = null;
    this.description = null;
    this.author = null;
    this.author_link = null;
    this.has_actions = false;
    this.info_badge = null;
    this.auto_updatable = false;
    this.order = 0;

    this.show_in_manager = true;
    this.preview_images_base = 'images';

    this.resources = new PgResourcesList();

    var ordered_list = [];
    var ordered = false;
    var types_map = null;

    var _this = this;

    this.removeAllComponents = function() {
        this.component_types = {};
        this.lib_sections = [];
        this.actions_sections = [];
        ordered = false;
        ordered_list = [];
    }

    this.isTrialActive = function() {
        return pinegrow.isProductTrialActive(this.key, this.trial_start_message, this.trial_expired_message);
    }

    this.addComponentType = function(def) {
        if(def.selector && typeof def.selector == 'string') {
            if(def.selector.match(/^[a-z]+$/i)) {
                def.selector_tag = def.selector.toUpperCase();
            }
        }
        this.component_types[def.type] = def;
        if(!def.priority) def.priority = 1000;
        def.framework = this;

        if(this.common_sections) {
            if(!def.sections) {
                def.sections = {};
            }
            $.each(this.common_sections, function(key, sdef) {
                def.sections[key] = sdef;
            });
        }
        ordered_list.push(def);
        ordered = false;
    }

    this.removeComponentType = function(def) {
        if(def.type in this.component_types) {
            delete this.component_types[def.type];
            var idx = ordered_list.indexOf(def);
            if(idx >= 0) {
                ordered_list.splice(idx, 1);
            }
            ordered = false;

            for(var n = 0; n < this.lib_sections.length; n++) {
                var s = this.lib_sections[n];
                var idx = s.components.indexOf(def);
                if(idx >= 0) {
                    s.components.splice(idx, 1);
                }
            }
            for(var n = 0; n < this.actions_sections.length; n++) {
                var s = this.actions_sections[n];
                var idx = s.components.indexOf(def);
                if(idx >= 0) {
                    s.components.splice(idx, 1);
                }
            }

        }
    }

    this.replaceComponent = function(old_c, new_c) {
        this.component_types[old_c.type] = new_c;
        var idx = ordered_list.indexOf(old_c);
        if(idx >= 0) {
            ordered_list[idx] = new_c;
        }
        for(var n = 0; n < this.lib_sections.length; n++) {
            var s = this.lib_sections[n];
            var idx = s.components.indexOf(old_c);
            if(idx >= 0) {
                s.components[idx] = new_c;
            }
        }
        for(var n = 0; n < this.actions_sections.length; n++) {
            var s = this.actions_sections[n];
            var idx = s.components.indexOf(old_c);
            if(idx >= 0) {
                s.components[idx] = new_c;
            }
        }
        new_c.framework = this;
    }

    var isType = function(def, $el, pgel, skip_actions) {
        var isType = false;
        if(skip_actions && def.action) return false;
        if(typeof def.selector == 'function') {
            if($el) {
                isType = def.selector($el);
            }
        } else if(def.selector) {
            isType = $el ? $el.is(def.selector) : pgel.isSelector(def.selector);
        } else if(def.selector_tag) {
            isType = $el ? $el.get(0).tagName === def.selector_tag : pgel.tagName === def.selector_tag;
        }
        return isType;
    }

    this.isType = function(def, $el, pgel, skip_actions) {
        return isType(def, $el, pgel, skip_actions);
    }

    var orderTypesIfNeeded = function() {
        if(!ordered) {
            ordered_list.sort(function(a,b) {
                return a.priority - b.priority;
            });
            ordered = true;

            //return;

            var tags = 0;
            var selectors = 0;
            var funcs = 0;
            var match = 0;
            var no_sel = 0;

            var map = {
                tags: {},
                check_all: []
            };

            types_map = map;

            var re = /^([a-z0-9]*)?(\.[a-z0-9\-\_]*)?(\[[a-z\-]*\])?(\[[a-z\-]*="(.*)"\])?$/i;

            for(var i = 0; i < ordered_list.length; i++) {
                if(ordered_list[i].selector) {
                    var info = {index: i, def: ordered_list[i]};

                    if(typeof ordered_list[i].selector == 'function') {
                        map.check_all.push(info);
                        funcs++;
                    } else {

                        var m = ordered_list[i].selector.match(re);
                        if(m) {
                            var tag = m[1];
                            if(tag) {
                                if(!map.tags[tag]) map.tags[tag] = [];
                                map.tags[tag].push(info);
                            } else {
                                map.check_all.push(info);
                            }
                        } else {
                            map.check_all.push(info);
                        }
                        /*
                        var m = true;
                        var ss = ordered_list[i].selector.split(',');
                        var matches = [];
                        for(var n = 0; n < ss.length; n++) {
                            var match = ss[n].trim().match(re);
                            if(!match) {
                                m = false;
                                break;
                            } else {
                                matches.push(match);
                            }
                        }
                        if(m) {
                            match++;
                            var branch = map;
                            for(var n = 0; n < matches.length; n++) {
                                var parts = matches[n];
                                var tag = parts[1];
                                if(tag) {
                                    if(!map.tags[tag]) map.tags[tag] = [];
                                    branch = map.tags[tag];
                                } else {
                                    branch = map.no_tag;
                                }

                            }
                        } else {
                            console.log(ordered_list[i].selector);
                        }*/
                    }
                } else {
                    no_sel++;
                }
            }
            if(ordered_list.length) {
                //console.log(types_map);
                //console.log('Selector stats for ' + _this.key + ': match=' + match + ' no_sel=' + no_sel + ' tags=' + tags + ' sels=' + selectors + ' funcs=' + funcs + ' total=' + ordered_list.length);
            }
        }

    }

    this.getType = function($el, pgel, skip_actions) {
        orderTypesIfNeeded();

        var types = this.getTypes($el, pgel, skip_actions, true);
        for(var i = 0; i < types.length; i++) {
            if(!types[i].not_main_type) {
                return types[i];
            }
        }
        return null;
        /*
        return types.length ? types[0] : null;


        for(var i = 0; i < ordered_list.length; i++) {
            var def = ordered_list[i];
            if(def.not_main_type) continue;
            if(isType(def, $el, pgel, skip_actions)) return def;
        }
        return null;
        */
    }

    this.getTypes = function($el, pgel, skip_actions, single) {
        orderTypesIfNeeded();

        if(single === undefined) single = false;
        var r = [];
        var info_list = [];
        var tag = pgel ? pgel.tagName : $el[0].tagName.toLowerCase();
        if(tag && types_map.tags[tag]) {
            for(var i = 0; i < types_map.tags[tag].length; i++) {
                if(isType(types_map.tags[tag][i].def, $el, pgel, skip_actions)) {
                    info_list.push(types_map.tags[tag][i]);
                    if(single) break;
                }
            }
        }
        for(var i = 0; i < types_map.check_all.length; i++) {
            if(isType(types_map.check_all[i].def, $el, pgel, skip_actions)) {
                info_list.push(types_map.check_all[i]);
                if(single) break;
            }
        }
        info_list.sort(function(a,b) {
            return a.index - b.index;
        });
        for(var i = 0; i < info_list.length; i++) {
            r.push(info_list[i].def);
            if(info_list[i].def.last_type) break;
        }
        return r;


        var r = [];

        for(var i = 0; i < ordered_list.length; i++) {
            var def = ordered_list[i];
            if( isType(def, $el, pgel, skip_actions)) {
                r.push(def);
                if(def.last_type) break;
                //return def;
            }
        }
        return r;
    }

    this.getComponentTypes = function() {
        return this.component_types;
    }

    this.getComponentType = function(type) {
        return this.component_types[type] ? this.component_types[type] : null;
    }

    this.addLibSection = function(section) {
        this.lib_sections.push(section);
        section.framework = this;
    }

    this.getLibSections = function() {
        return this.lib_sections;
    }

    this.getLibSection = function(key) {
        for(var s in this.lib_sections) {
            if(this.lib_sections[s].key == key) return this.lib_sections[s];
        }
        return null;
    }

    this.addActionsSection = function(section) {
        this.actions_sections.push(section);
        section.framework = this;
    }

    this.getActionsSections = function() {
        return this.actions_sections;
    }

    this.getAutoId = function(prefix) {
        var c = 0;
        var t;
        do {
            c++;
            t = prefix + (c > 0 ? c : '');
        }
        while((t in this.component_types));

        return {count: c, type: t};
    }

    this.getFileName = function() {
        if(this.pluginUrl) {
            return getPageName(this.pluginUrl);
        } else {
            return this.name.replace(/\s/ig,'') + '.js';
        }
    }

    this.getImagePreviewBaseUrl = function() {
        return this.getBaseUrl() + '/' + this.preview_images_base + '/';
    }

    this.getBaseUrl = function() {
        if(this.project) return crsaMakeUrlFromFile(this.project.getDir());
        console.log(crsaGetBaseForUrl(this.script_url));
        return crsaGetBaseForUrl(this.pluginUrl ? this.pluginUrl : this.script_url);
    }

    this.getResourceUrl = function(relative_path) {
        return this.getBaseUrl() + '/' + relative_path;
    }

    this.getResourceFile = function(relpath) {
        return crsaMakeFileFromUrl(this.getResourceUrl(relpath)) ;
    }

    this.setScriptFileByScriptTagId = function(id, def_value) {
        var script = $('#' + id);
        if(script.length) {
            this.script_url = script.get(0).src; //get url if script is included directly into edit.html
        } else if(def_value) {
            var path = require('path');
            this.script_url = crsaMakeUrlFromFile( path.join( process.cwd(), def_value ));
        }
    }

    this.addTemplateProjectFromResourceFolder = function(folder, done, index, filter_func) {
        var path = require('path');
        var base_url = this.getBaseUrl();
        if(!base_url) return;
        var full_path = path.join(crsaMakeFileFromUrl(base_url), folder);
        service.addTemplateProjectFromFolder(full_path, function(p) {
            p.name = _this.name;
            p.description = _this.description;
            p.author = _this.author;
            p.author_link = _this.author_link;
            p.info_badge = _this.info_badge || null;
            p.framework = _this;

            p.root.walkThroughFiles(function(node) {
                if(node.name == 'screenshots') {
                    return false;
                } else if(node.name.indexOf('.html') >= 0) {
                    node.tag = 'page';
                    node.image = p.root.url + '/screenshots' + '/' + node.name.replace('html', 'jpg');
                } else {
                    node.required = true;
                }
                if(filter_func) return filter_func(node, p);
            })

            if(done) {
                done(p);
            }
        }, index);
    }

    this.save = function(url, done) {
        if(url != this.pluginUrl) {
            this.name = getPageName(url).replace(/\.js$/i,'');
            this.key = this.name;
        }
        var s = '';
        var comp_list = [];

        $.each(this.component_types, function(i, def) {
            var type = def.type;
            var vn = "comp_" + type.replace(/-/g,'_');
            s += def.toJSCode(vn);
            comp_list.push(vn);
        });

        var source = '\
                    $(function() {\n\
                    \n\
                        //Wait for Pinegrow to wake-up\n\
                        $("body").one("pinegrow-ready", function(e, pinegrow) {\n\
                    \n\
                            //Create new Pinegrow framework object\n\
                            var f = new PgFramework("' + this.key + '", "' + this.name + '");\n\
                    \n\
                            //This will prevent activating multiple versions of this framework being loaded\n\
                            f.type = "' + this.key + '";\n\
                            f.allow_single_type = true;\n\
                            f.user_lib = ' + (this.user_lib ? 'true' : 'false') + '\
                    \n\
                    ' + s + '\n\
                            //Tell Pinegrow about the framework\n\
                            pinegrow.addFramework(f);\n\
                                \n\
                            var section = new PgFrameworkLibSection("' + this.key + '_lib", "Components");\n\
                            //Pass components in array\n\
                            section.setComponentTypes([' + comp_list.join(', ') + ']);\n\
                    \n\
                            f.addLibSection(section);\n\
                       });\n\
                    });';

        try {
            var file = crsaMakeFileFromUrl(url);
            var fs = require('fs');
            crsaWriteFileWithBackup(fs, file, source, "utf8");
            this.pluginUrl = url;
            pinegrow.saveFrameworksList();
            this.changed = false;
        }
        catch(err) {
            showAlert("File " + url + " could not be saved. " + err, "Error");
        }

        if(done) done();
    }

    this.getActionTypes = function($el, pgel) {
        return this.getTypes($el, pgel);
    }

    this.getActionTag = function($el) {
        var types = this.getActionTypes($el);
        if(types.length) {
            var at = '';
            for(var i = 0;i < types.length; i++) {
                var t;
                if(types[i].get_action_tag) {
                    t = types[i].get_action_tag($el, types[i]);
                } else {
                    t = (types[i].short_name || types[i].name);
                }
                at += (at.length ? ', ' : '') + t;
            }
            return at;
        }
        return null;
    }


    this.textForExample = function(what) {
        return 'for example, ' + what;
    }

    this.textDefaultValue = function(what) {
        return 'default, ' + what;
    }

    this.textUse = function(what) {
        return 'use ' + what;
    }

    this.fieldIsRequired = function(obj, prop, value, fieldDef, $field, values) {
        if(!value) {
            return pinegrow.getValidationError(fieldDef.name, 'req');
        }
        return null;
    }

    //CSS helpers
    this.setCSSProperty = function(page, css_url, selector, prop, value) {

    }


    this.requireSelectedElement = function(callback) {
        var cp = pinegrow.getSelectedPage();
        if(!cp) {
            pinegrow.showQuickMessage('A page must be open for this to work.');
        } else {
            var el = pinegrow.getSelectedElement();
            if(!el) {
                pinegrow.showQuickMessage('An element must be selected.');
            } else {
                var $el = el.data;
                var pgel = new pgQuery($el);
                callback(cp, $el, pgel);
            }
        }
    }


    this.on_element_inserted = function(page, pgel, $el, def) {

        if(def.framework && def.framework == this) {
            //that's us
            if(def.framework.resources.has()) {
                var res_namespace = page.getResourceNamespaceForFramework(def.framework);

                //skip this if framework is source framework for this project: TODO

                if(res_namespace) {
                    var fs = require('fs');

                    var $html = page.get$Html();
                    //we should map urls
                    var attrs = ['src', 'data-src', 'href', 'action'];
                    for(var i = 0; i < attrs.length; i++) {
                        var attr = attrs[i];
                        var list = pgel.findIncludingSelf('[' + attr + ']');
                        for(var j = 0; j < list.length; j++) {
                            var el = list[j];
                            var url = el.getAttr(attr);
                            if(url && !crsaIsAbsoluteUrl(url)) {

                                url = res_namespace + url;
                                var file = crsaMakeFileFromUrl( page.makeAbsoluteUrl(url) );
                                if(crsaIsFileOrDir(file, fs) == 'file') {
                                    //resource file exists at new location, lets update url
                                    el.setAttr(attr, url);
                                    var $domel = el.get$DOMElement($html);
                                    if($domel) {
                                        $domel.attr(attr, url);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    this.addResourcesToPage = function(page, done, overwrite_existing, same_project) {
        var path = require('path');
        var wasChanged = function() {
            var $head = page.get$Html().find('head');
            pinegrow.setNeedsUpdate($head, true);
        }

        var project = pinegrow.getCurrentProject();

        var resource_folder = null;
        var changed = false;
        if(project && project.isFileInProject(page.localFile)) {
            resource_folder = project.getDir();
        } else if(page.localFile) {
            resource_folder = path.dirname( page.localFile );
        }

        if(resource_folder) {

            var res_namespace = this.getResourceNamespacePath();
            if(same_project) {
                //
            } else {
                resource_folder = path.join(resource_folder, res_namespace);
            }
            //page.setResourceNamespaceForFramework(this, res_namespace);

            this.resources.copyFilesToFolder( resource_folder, function( errors ) {
                if(_this.resources.addToPage(page, resource_folder)) {
                    //changed
                    wasChanged();
                    changed = true;
                    if(done) done();
                }
            }, overwrite_existing /* dont overwrite existing */)
        } else {
            if(_this.resources.addToPage(page)) {
                //changed
                wasChanged();
                changed = true;
                if(done) done();
            }
        }
        if (!changed)
            pinegrow.refreshAllPages();
    }

    this.addResourcesToProject = function(project, done, overwrite_existing, same_project) {
        var path = require('path');

        var wasChanged = function() {
            var $head = page.get$Html().find('head');
            pinegrow.setNeedsUpdate($head, true);
        }

        var resource_folder = project.getDir();

        var res_namespace = this.getResourceNamespacePath();

        if(same_project) {
            resource_folder += path.sep;
        } else {
            resource_folder = resource_folder + path.sep + res_namespace;
        }

        /*var project_info = project.getProjectInfo();
        var resources = project_info.getSetting('resources') || {};
        resources[this.type] = res_namespace;
        project_info.setSetting('resources', resources);
        project_info.save();*/

        this.resources.copyFilesToFolder( resource_folder, function( errors ) {
            //add to pages

            project.forEachEditableFile( function( page, pageDone, status ) {
                //on page
                if(_this.resources.addToPage(page, resource_folder)) {
                    status.changed = true;
                }
                pageDone(page, status);

            }, function() {
                //on done
                if(done) done();
            }, 'Updating resources...')

        }, overwrite_existing);
    }

    this.getResourceNamespace = function() {
        return 'components/' + (this.type || this.key) + '/';
    }

    this.getResourceNamespacePath = function() {
        return this.getResourceNamespace().replace(/\//g, require('path').sep);
    }

}

var PgFrameworkLibSection = function(key, name) {
    this.key = key;
    this.name = name;
    this.components = [];
    this.framework = null;

    this.addComponentType = function(pgComponentType) {
        this.components.push(pgComponentType);
    }

    this.setComponentTypes = function(list) {
        this.components = list;
    }

    this.getComponentTypes = function() {
        return this.components;
    }
}

var PgComponentTypeResource = function(url, code) {
    this.type = service.getMimeType(url);
    this.url = url;
    this.code = code;
    this.footer = false;
    this.project = null;
    this.isFolder = false;
    this.source = null;
    this.relative_url = null;

    this.isEqual = function(r) {
        return this.url == r.url || (this.code && this.code == r.code);
    }

    this.addToPage = function(crsaPage, folder) {
        var url = this.url;

        if(this.relative_url && !crsaIsAbsoluteUrl(this.relative_url) && this.relative_url && folder) {
            url = crsaMakeUrlFromFile( require('path').join(folder, this.relative_url));
        }

        if(this.type == 'text/css') {
            return crsaPage.addStylesheet(url, false);
        } else if(this.type == 'application/javascript') {
            return crsaPage.addScript(url, this.footer);
        } else if(this.isFolder) {

        }
        return false; //not changed
    }

    this.copyFilesToPage = function(crsaPage, done) {
        this.copyFilesToFolder( require('path').dirname( crsaPage.localFile ), done);
    }

    this.copyFilesToProject = function(project, done) {
        this.copyFilesToFolder(project.getDir(), done);
    }

    this.copyFilesToFolder = function(folder, done, overwrite_existing) {
        //copy to project
        var path = require('path');

        var relative_to_source_project = crsaMakeFileFromUrl(this.relative_url);
        if (crsaIsAbsoluteUrl(this.relative_url || this.url)) {
            if (done) done();
            return;
        }

        var source_path = crsaMakeFileFromUrl(this.url);
        var dest_path = path.join(folder, relative_to_source_project);

        console.log('RESOURCES - COPY ' + source_path + ' -> ' + dest_path);

        if(source_path == dest_path) {
            if(done) done();
            return;
        }

        this.copy(dest_path, done, overwrite_existing);
    }

    /*
    this.existsInFolder = ===function(folder) {
        //copy to project
        var path = require('path');

        var relative_to_source_project = crsaMakeFileFromUrl(this.relative_url);
        if (crsaIsAbsoluteUrl(this.relative_url || this.url)) {
            return true;
        }

        var source_path = crsaMakeFileFromUrl(this.url);
        var dest_path = path.join(folder, relative_to_source_project);


        this.copy(dest_path, done, overwrite_existing);
    }

*/

    this.copy = function(dest, done, overwrite_existing, file_writter) {
        var path = require('path');
        var fs = require('fs');

        try {
            crsaCreateDirs(path.dirname(dest), fs);

            var type = crsaIsFileOrDir(crsaMakeFileFromUrl(this.source), fs);

            if(type == 'dir') {
                crsaCopyFolder(crsaMakeFileFromUrl(this.source), dest, function(errors) {
                    if(done) done(errors);
                }, true /* quick, overwrite newer */ )
            } else if(type == 'file') {
                //console.log("RES " + this.source + ' -> ' + dest);

                var dest_exists = false;
                try {
                    var stat_dest = fs.statSync(dest);
                    var stat_source = fs.statSync(crsaMakeFileFromUrl(this.source));
                    //exists
                    dest_exists = (stat_source.isFile() && stat_dest.mtime >= stat_source.mtime);
                } catch(err) {
                    dest_exists = false;
                }

                if(!dest_exists || overwrite_existing) {
                    if(file_writter) {
                        file_writter.copyFile(dest, crsaMakeFileFromUrl(this.source));
                    } else {
                        crsaCopyFileSync(fs, crsaMakeFileFromUrl(this.source), dest);
                    }
                } else {
                    //console.log('SKIP ' + dest);
                }

                if(done) done();
            } else {
                if(done) done(crsaMakeFileFromUrl(this.source) + ' does not exist.');
            }
        } catch(err) {
            console.log('COPY ERROR ' + err);
            if(done) done(err);
        }
    }
}

var PgResourcesList = function() {

    this.list = [];
    var _this = this;

    var description = null;

    this.clear = function () {
        this.list = [];
    }

    this.has = function() {
        return this.list.length > 0;
    }

    this.add = function(r) {
        for(var i = 0; i < this.list.length; i++) {
            if(this.list[i].isEqual(r)) return;
        }
        this.list.push(r);
    }

    /*
    @crsaPage: page to add to
    @folder: location of resource, either project dir or file dir
     */
    this.addToPage = function(crsaPage, folder, done) {
        var changed = false;
        for(var i = 0; i < this.list.length; i++) {
            changed = this.list[i].addToPage(crsaPage, folder) || changed;
        }
        if(done) done(crsaPage, this);
        return changed;
    }

    this.copyFilesToFolder = function(folder, done, overwrite_existing) {
        var idx = 0;

        var copyItem = function() {
            if(idx == _this.list.length) {
                if(done) done();
            } else {
                _this.list[idx].copyFilesToFolder(folder, function(errors) {
                    idx++;
                    copyItem();
                }, overwrite_existing);
            }
        }

        copyItem();
    }

}

var PgComponentType = function(type, name) {
    this.type = type;
    this.name = name;
    this.short_name = name;
    this.selector = null;
    this.code = null;
    this.preview = null;
    this.sections = null;
    this.priority = 1000;
    this.attribute = null; //for actions
    this.attribute_default = null;
    this.parameter_attributes = []; //array of {name, default}
    this.parent_selector = null;
    this.inherit_from = null;
    this.empty_placeholder = null;
    this.display_name = null;
    this.live_update = true;
    this.framework = null;
    this.set_value = null;//set_value(obj, value, values, oldValue, eventType);
    this.resources = [];

    this.toJSCode = function(vn) {
        var escapeCode = function(code) {
            code = html_beautify(code);
            code = code.replace(/\r\n|\r|\n/g, '\\\n');
            return code.replace(/'/g,'\\\'');
        }

        var c = '\n\
        var ' + vn + ' = new PgComponentType(\'' + this.type + '\', \'' + escapeCode(this.name) + '\');\n\
        ' + vn + '.code = \'' + escapeCode(this.code) + '\';\n\
        ' + vn + '.parent_selector = ' + (this.parent_selector ? '\'' + this.parent_selector + '\'' : 'null') + ';\n\
        f.addComponentType(' + vn + ');\n\
        ';
        return c;
    }

    this.addResource = function(res) {
        if(this.resources.indexOf(res) < 0) this.resources.push(res);
    }

    this.addResources = function(res_list) {
        for(var i = 0; i < res_list.length; i++) {
            this.addResource(res_list[i]);
        }
    }



    this.addRequireCSS = function(res) {
        if(this.require_css.indexOf(res) < 0) this.require_css.push(res);
    }

    this.getActionParameters = function() {
        var r = [];
        $.each(this.sections, function(skey, sdef) {
            if(sdef.fields) {
                $.each(sdef.fields, function(fkey, fdef) {
                    if(fdef.attribute) {
                        r.push({name: fdef.attribute, 'default': fdef.default ? fdef.default : null});
                    }
                });
            }
        });
        return r;
    }

}

var PgPropertiesSection = function(key, name) {
    this.key = key;
    this.name = name;
    this.fields = {};

    this.addProperty = function(pgProp, key) {
        if(!key) key = pgProp.key;
        this.fields[pgProp.key] = pgProp;
    }
}

var PgProperty = function(key, name) {
    this.name = name;
    this.key = key;
    this.type = null;
    this.action = null;
    this.get_value = null;
    this.set_value = null;
    this.value = null;
    this.show_empty = null;
    this.attribute = null;
    this.options = null;
}

var PgComponent = function(name, done) {

    this.html = null;
    this.error = null;
    this.url = null;

    var _this = this;

    this.url = "components/" + name + '.html';

    if(isApp()) {
        var fs = require('fs');
        try {
            this.html = fs.readFileSync(crsaMakeFileFromUrl(this.url), {encoding: "utf8"});
            if(done) done(this);
        }
        catch(err) {
            this.error = err;
            if(done) done(this);
        }
    } else {
        $.ajax({
            url: this.url,
            data: null,
            dataType: 'text'
        })
            .done(function(data) {
                _this.html = data;
                if(done) done(_this);
            })
            .fail(function(a) {
                _this.error = a;
                if(done) done(_this);
            });
    }
}

var PgStats = function() {

    var events = [];
    var usage = {};
    var has_usage = false;

    var test = true;
    var _this = this;

    var install_id = crsaStorage.getValue('install_id');

    if(!install_id) {
        install_id = 'id' + new Date().getTime() + Math.round(Math.random() * 100000);
        crsaStorage.setValue('install_id', install_id);
    }

    setInterval(function() {
        _this.send();
    }, 1000*60*10);

    var version = crsaGetVersion();

    var app_run = parseInt(localStorage.app_run || "0");

    var fillUserData = function(e) {
        e.trialEmail = crsaStorage.getValue('userEmail');
        e.userEmail = crsaStorage.getValue('activatedUserEmail');
        e.serial = crsaStorage.getValue('activatedSerial');
        e.version = version;
        e.product = crsaStorage.getValue('activatedProduct');
        e.appRun = app_run;
        e.installId = install_id;
    }

    this.event = function(event, data, force) {
        var disable_stats = pinegrow && pinegrow.getSetting('disable-stats', '0') == '1';

        if(disable_stats && !force) return;

        var e = {};

        e.event = event;
        e.data = data || '';
        e.time = parseInt(new Date().getTime()/1000);
        fillUserData(e);

        events.push(e);

        if(test) this.send();
    }

    this.using = function(what) {
        if(!(what in usage)) {
            usage[what] = 0;
        }
        usage[what]++;
        has_usage = true;
    }

    var in_progress = false;

    this.send = function(done) {

        var disable_stats = pinegrow && pinegrow.getSetting('disable-stats', '0') == '1';

        //debugger;
        if(in_progress) {
            if(done) done();
            return;
        }

        if(events.length == 0 && (!has_usage || disable_stats)) {
            if(done) done();
            return;
        }

        var salt = 'jhuyuy575rhgty';

        var d = {};
        fillUserData(d);

        d.events = events;

        if(!disable_stats) {
            d.usage = usage;
        }

        var str = JSON.stringify(d);
        str = window.btoa(str);

        var url = 'http://shop.pinegrow.com/PinegrowEvents/event.php';

        //url = 'http://pinegrow/PinegrowEvents/event.php';

        in_progress = true;

        //console.log('sending stats...' + str);

        $.ajax({
            url: url,
            data: {str: str, id: md5(str + salt)},
            dataType: 'text',
            method: 'POST'
        }).done(function(data) {
            events = [];
            usage = {};
            has_usage = false;
            in_progress = false;

            //console.log('Got reply: ' + data);

            try {
                data = JSON.parse(data);
                if(data.msg_title) {
                    var delay = data.msg_delay || 10000;
                    setTimeout(function() {
                        pinegrow.showAlert(data.msg_text || '', data.msg_title);
                    }, delay);

                }
            } catch(err) {}

        }).fail(function(a, b, c) {
            in_progress = false;
        });

        setTimeout(function() {
            if(done) done();
        }, 1000);
    }
}

var CrsaCollapsibleSections = function ($list) {
    function slideToggle(el, callback){
      var $el = $(el), height = $el.data("originalHeight"), visible = $el.is(":visible");
      bShow = !visible;
      if( bShow == visible ) return false;
      if( !height ){
        height = $el.show().height();
        $el.data("originalHeight", height);
        if( !visible ) $el.hide().css({height: 0});
      }

      if( bShow ){
        $el.show().animate({height: height}, {duration: 250, complete:function (){
            $el.height('auto');
            if (callback) callback();
          }
        });
      } else {
        $el.animate({height: 0}, {duration: 250, complete:function (){
            $el.hide();
            if (callback) callback();
          }
        });
      }
    }

    this.show = function (getSectionDef, updateUsage) {
        $list.find('li.section > div').on('click', function(e) {
            var $section = $(e.delegateTarget).parent();
            var sec_def = getSectionDef($section);
            var $ul = $section.find('>ul');

            if($section.hasClass('section-closed')) {
                slideToggle($ul, function () {
                    $section.removeClass('section-closed');
                    if(sec_def) {
                        sec_def.closed = false;
                        var k = 'sec_open_' + sec_def.key;
                        localStorage[k] = '1'; //open
                    }
                })
            } else {
                slideToggle($ul, function () {
                    $section.addClass('section-closed');
                    if(sec_def) {
                        sec_def.closed = true;
                        var k = 'sec_open_' + sec_def.key;
                        localStorage[k] = '0'; //closed
                    }
                });
            }
            if (updateUsage) updateUsage($section);
        });

        // if(pinegrow.getSelectedElement() && updateUsage) {
        //     updateUsage();
        // }
    }
}
