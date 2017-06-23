/*
Copyright Humane tehnologije d.o.o.
 */

var PgInsight = function() {

    var _this = this;

    var forEachSource = function(func) {
        //current page for now
        var project = service.getCurrentProject();
        var page = service.getSelectedCrsaPage();

        if(page) {
            if(project && project.isPageInProject(page)) {
                project.forEachOpenPage(function(p) {
                    func(p.sourceNode);
                });
            } else {
                func(page.sourceNode);
            }
        }
    }

    var cache = null;
    var stylesheets_done = null;
    
    var contents_tags = ['title'];
    
    var handlers_on_begin_inspecting_project = [];
    var handlers_on_inspect_page = [];
    var handlers_on_end_inspecting_project = [];
    
    this.addHandler = function(on_begin, on_inspect_page, on_end) {
        if(on_begin) {
            handlers_on_begin_inspecting_project.push(on_begin);
        }
        if(on_inspect_page) {
            handlers_on_inspect_page.push(on_inspect_page);
        }
        if(on_end) {
            handlers_on_end_inspecting_project.push(on_end);
        }
    }
    
    this.ext = {}; //for extensions

    var beginInspectingProject = function() {
        cache = {
            classes_map : {},
            classes_list : [],
            classes_changed : false,
            ids_map : {},
            ids_list : [],
            ids_changed : false,
            attribute_values : {},
            tags_attribute_values : {},
            keywords_map : {},
            keywords_list : [],
            keywords_changed : false,
            contents : {},
            meta: {}
        }
        stylesheets_done = {};
        
        handlers_on_begin_inspecting_project.forEach(function(func) {
            func(_this);
        })
    }

    beginInspectingProject(); //init cache

    var attributes_by_tags = ['img', 'iframe', 'style', 'script'];

    var inspectAProjectItem = function(page, changedPgel, do_html, do_css) {
        if(do_html === undefined) do_html = true;
        if(do_css === undefined) do_css = true;
        
        var handlers_on_inspect_node = [];
            
        handlers_on_inspect_page.forEach(function(func) {
            var inspect_node_func = func(_this, page);
            if(inspect_node_func) {
                handlers_on_inspect_node.push(inspect_node_func);
            }
        })
	    
	    var addClass = function(cls, source) {
            if(cls === null || cls.length === 0) return;
		    if(!(cls in cache.classes_map)) {
                var item = {key: cls, name: cls, count: 1, sources: []};
                cache.classes_map[cls] = item;
                cache.classes_list.push(item);
                cache.classes_changed = true;
                if(source && item.sources.indexOf(source) < 0) {
                    item.sources.push(source);
                }
            } else {
                cache.classes_map[cls].count++;
                if(source && cache.classes_map[cls].sources.indexOf(source) < 0) {
                    cache.classes_map[cls].sources.push(source);
                }
            }
	    }
        
        var addId = function(id) {
            if(id === null || id.length === 0) return;
		    if(!(id in cache.ids_map)) {
                var item = {key: id, name: id, count: 1}
                cache.ids_map[id] = item;
                cache.ids_list.push(item);
                cache.ids_changed = true;
            } else {
                cache.ids_map[id].count++;
            }
	    }
	    
        if(do_html) {
            var sourceNode = changedPgel ? changedPgel : page.sourceNode;
            sourceNode.walkSelfAndChildren(function(node) {
                if(node.isElement) {
                    var list = node.getClasses();
                    for(var i = 0; i < list.length; i++) {
                        addClass(list[i]);    
                    }
                    
                    var id = node.getAttr('id');
                    if(id) addId(id);

                    var attrs = node.getAttrList();
                    var tag_attrs = null;
                    if(attributes_by_tags.indexOf(node.tagName) >= 0) {
                        if(!(node.tagName in cache.tags_attribute_values)) {
                            cache.tags_attribute_values[node.tagName] = {};
                        }
                        tag_attrs = cache.tags_attribute_values[node.tagName];
                    }
                    for(var i = 0; i < attrs.length; i++) {
                        var attr_value = attrs[i].value;
                        if(attr_value) {
                            if(attr_value.startsWith('http')) {
                                attr_value = pinegrow.getOriginalUrl(attr_value);
                            }
                            if(!(attrs[i].name in cache.attribute_values)) {
                                cache.attribute_values[attrs[i].name] = {};
                            }
                            cache.attribute_values[attrs[i].name][attr_value] = true;

                            if(tag_attrs) {
                                if(!(attrs[i].name in tag_attrs)) {
                                    tag_attrs[attrs[i].name] = {};
                                }
                                tag_attrs[attrs[i].name][attr_value] = true;
                            }
                        }
                    }
                    if(node.tagName == 'meta') {
                        var metaName = node.getAttr('name');
                        var metaContent = (node.getAttr('content') || '').trim();
                        switch(metaName) {
                            case 'keywords':
                                var list = metaContent.split(',');
                                for(var i = 0; i < list.length; i++) {
                                    var kw = list[i].trim();
                                    if(kw.length && !(kw in cache.keywords_map)) {
                                        cache.keywords_map[kw] = true;
                                        cache.keywords_list.push({key: kw, name: kw});
                                        cache.keywords_changed = true;
                                    }
                                }
                                break;   
                            default:
                                if(metaContent.length) {
                                    if(!(metaName in cache.meta)) {
                                        cache.meta[metaName] = {};
                                    }
                                    cache.meta[metaName][metaContent] = true;
                                }
                                break; 
                        }
                    }
                    if(contents_tags.indexOf(node.tagName) >= 0) {
                        if(!(node.tagName in cache.contents)) {
                            cache.contents[node.tagName] = {};
                        }
                        cache.contents[node.tagName][node.html()] = true;
                    }
                    handlers_on_inspect_node.forEach(function(func) {
                        func(_this, page, node);
                    })
                }
                return true;
            })           
            if(changedPgel) return; //quick, just do the changed element
        }
        
        //do csss
        if(do_css) {
            var doCSSRules = function(p, source) {
                if(p.cssRules) {
                    for(var i = 0; i < p.cssRules.length; i++) {
                        if(p.cssRules[i].type == 1) {
                            var sel = p.cssRules[i].selectorText;
                            var classes = sel.match(/\.([a-z0-9\-\_]*)/g);
                            var ids = sel.match(/\#([a-z0-9\-\_]*)/g);
                            if(classes) {
                                for(n = 0; n < classes.length; n++) {
                                    var cls = classes[n].substr(1, classes[n].length - 1);
                                    addClass(cls, source);
                                }
                            }
                            if(ids) {
                                for(n = 0; n < ids.length; n++) {
                                    var id = ids[n].substr(1, ids[n].length - 1);
                                    addId(id, source);
                                }
                            }
                        }
                        doCSSRules(p.cssRules[i], source);
                    }
                }
            }
            if(page.openedInEditor) {
                var $html = page.get$Html();
                if($html) {
                    $html.find('style, link[rel="stylesheet"]').each(function(i, e) {
                        if(e.getAttribute('id') != 'crsa-inline-styles') {
                            if(e.href) {
                                if(stylesheets_done[e.href.toString()]) return true;
                                stylesheets_done[e.href.toString()] = true;
                            }
                            if(e.sheet) doCSSRules(e.sheet, e.href ? crsaGetNameFromUrl(e.href.toString()) : 'inline');
                        }
                    })
                }
            }
        }
    }
    
    var sortOptionsList = function(list) {
        var c = new Intl.Collator();
        list.sort(function(a,b) {
            return c.compare(a.key, b.key);
        })
    }
    
    this.sortOptionsList = sortOptionsList;

    var endInspectingProject = function() {
        if(cache.classes_changed) {
            sortOptionsList(cache.classes_list);
            cache.classes_changed = false;
            
            cache.classes_list.forEach(function(item) {
                if(item.sources.length) {
                    var html = item.sources[0];
                    if(item.sources.length > 1) {
                        html += ' + ' + (item.sources.length - 1) + ' more';
                    }
                    item.html = item.name + ' <small>' + html + '</small>';
                }    
            })
        }
        if(cache.ids_changed) {
            sortOptionsList(cache.ids_list);
            cache.ids_changed = false;
        }
        /*
        for(var attr in cache.attribute_values) {
            if (cache.attribute_values.hasOwnProperty(attr)) {
                cache.attribute_values[attr].sort();
            }
        }
        for(var tag in cache.tags_attribute_values) {
            if (cache.tags_attribute_values.hasOwnProperty(tag)) {
                for(var attr in cache.tags_attribute_values[tag]) {
                    if (cache.tags_attribute_values[tag].hasOwnProperty(attr)) {
                        cache.tags_attribute_values[tag][attr].sort();
                    }
                }
            }
        }
        */
        //console.log(cache);
        
        handlers_on_end_inspecting_project.forEach(function(func) {
            func(_this);
        })
    }

    var profile_total = null;

    $('body').one('wfb-ready', function (e, pinegrow) {

        var f = new PgFramework('pg.insight.events', 'PG Insight');
        pinegrow.addFramework(f);

        f.default = true;
        f.show_in_manager = false;

        f.on_project_scan_begin = function(nothing, project, ref) {
            profile_total = new CrsaProfile();
            beginInspectingProject();
            profile_total.pause();
        }

        f.on_project_scan_page = function(nothing, project, page, ref) {
            profile_total.resume();
            inspectAProjectItem(page);
            profile_total.pause();
        }

        f.on_project_scan_end = function(nothing, project, ref) {
            profile_total.show('PgInsight.on_project_scan_end begin');
            profile_total.resume();
            endInspectingProject();
            profile_total.show('PgInsight.on_project_scan_end end');
        }

        var rescan_timeout = null;

        var rescan_delay = 1000;
        
        var scanPage = function(page, changedPgel, do_html, do_css) {
	        if(rescan_timeout) {
                clearTimeout(rescan_timeout);
            }
            rescan_timeout = setTimeout(function() {
                var profile = new CrsaProfile();
                var start = new Date().getTime();
                
                stylesheets_done = {};
                
                try {
                    inspectAProjectItem(page, changedPgel, do_html, do_css);
                } catch(err) {}
                endInspectingProject();
                profile.show('PgInsight.rescanChangedPage');
                var elapsed = new Date().getTime() - start;

                rescan_delay = elapsed * 50;
                if(rescan_delay < 1000) rescan_delay = 1000;
                if(rescan_delay > 60000) rescan_delay = 60000;
                
                //rescan_delay = 500;

                //console.log('PgInsight.rescan_delay = ' + rescan_delay);

                rescan_timeout = null;
            }, changedPgel ? 0 : rescan_delay)

        }

        f.on_page_changed = function(page, changed_el, event_type) {
            var pgel = null;
            if(changed_el) pgel = getElementPgNode(changed_el);
            
            if(event_type && event_type == 'change') {
                scanPage(page, pgel, true, false);
                return;
            } else if($(document.activeElement).is('.crsa-input')) {
                return;
            }
	        scanPage(page, pgel, true, true);
        }
        
        f.on_page_loaded = function(page) {
	        scanPage(page, null, true, true);
        }
        
        $('body').on('crsa-rules-changed', function() {
            var page = pinegrow.getSelectedPage();
            if(page) {
                scanPage(page, null, false, true);    
            }
        })
    });


    this.find = function(selector) {
        var r = [];
        forEachSource( function(sourceNode) {
            r = r.concat(sourceNode.find(selector));
        })
        return r;
    }
    
    var objectValuesToOptionList = function(values) {
        var r = Object.keys(values).sort();
        var list = [];
        for(var i = 0; i < r.length; i++) {
            list.push({key: r[i], name: r[i]});
        }
        return list;
    }

    this.getClasses = function() {
        return cache.classes_list;
    }

    this.getValuesForAttribute = function(attribute, tag) {
        var map = null;
        if(tag) {
            map = cache.tags_attribute_values[tag] || {};
        } else {
            map = cache.attribute_values;
        }
        return objectValuesToOptionList(map[attribute] || {});
    }
    
    this.getContentsForTag = function(tag) {
        return objectValuesToOptionList(cache.contents[tag] || {});
    }
    
    this.getMetaValuesForName = function(name) {
        return objectValuesToOptionList(cache.meta[name] || {});
    }

    this.getIds = function() {
        return cache.ids_list;
    }
    
    this.getKeywords = function() {
        if(cache.keywords_changed) {
            sortOptionsList(cache.keywords_list);
            cache.keywords_changed = false;
        }
        return cache.keywords_list;
    }
}