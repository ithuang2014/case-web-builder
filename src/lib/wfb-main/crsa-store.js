/**
 * Created by Matjaz on 11/9/13.
 */

var CrsaBrowserStorage = function() {

    var getKey = function(url) {
        return 'localSave_' + url;
    }

    this.save = function(url, data) {
        var key = getKey(url);
        localStorage[key] = data;
    }

    this.exists = function(url) {
        return getKey(url) in localStorage;
    }

    this.load = function(url) {
        var key = getKey(url);
        return (key in localStorage) ? localStorage[key] : null;
    }

    this.saveProject = function() {
        var d = {pages: [], css: []};
        $.each($.fn.crsapages('getAllPages'), function(i, cp) {
            d.pages.push({url: cp.url, html: cp.getSource(false), name: cp.name});
            cp.setPageChanged(false);
        });
        if(d.pages.length == 0) return null;
        $.each($.fn.crsacss('getAllCrsaStylesheets'), function(i, cs) {
            if(!cs.inline && cs.loaded) {
                d.css.push({url: cs.url, less: cs.genGetSource()});
                cs.changed = false;
            }
        });
        var str = JSON.stringify(d);
        if(str.length > 2000000) {
            pinegrow.alert('Sorry, the project is too big to save. Use File -> Save.');
        } else {
            localStorage.savedProject = str;
        }
        return d;
    }

    this.hasSavedProject = function() {
        return 'savedProject' in localStorage;
    }

    this.restoreProject = function(done) {
        if(!this.hasSavedProject()) return null;

        try {
            var json = localStorage.savedProject;
            var d = JSON.parse(json);

            var idx = 0;

            var cssidx = 0;

            var loadCss = function() {
                if(cssidx >= d.css.length) {
                    //done
                    $('body').trigger('crsa-stylesheets-changed');
                    if(done) done();
                } else {
                    var css = d.css[cssidx];
                    var cslist = findCrsaStylesheetForUrl(css.url);
                    var cs;
                    if(cslist && cslist.length > 0) {
                        cs = cslist[0];
                        cs.genSetSource(css.less, function() {
                            cssidx++;
                            loadCss();
                        });
                    } else {
                        $.fn.crsacss('addStylesheetFromUrl', css.url, function(cs) {
                            cs.genSetSource(css.less, function() {
                                cssidx++;
                                loadCss();
                            });
                        });
                    }
                }
            }

            var loadPage = function() {
                var page = d.pages[idx];
                $.fn.crsa("openPage", page.url, function() {

                }, function(crsaPage) {

                    setPageSource(crsaPage.$iframe, page.html, null, true);

                    crsaPage.runScripts(function() {
                        crsaPage.callFrameworkHandler('on_page_loaded');
                        $.fn.crsa('updateIfNeeded');
                        crsaPage.addCrsaStyles();
                    });

                    if(page.name) {
                        crsaPage.name = page.name;
                        crsaPage.updateNameDisplay();
                    }
                }, null, function(crsaPage) {
                    //done
                    idx++;
                    if(idx < d.pages.length) {
                        loadPage();
                    } else {
                        //load csss
                        loadCss();
                    }
                });
            }

            if(d.pages.length > 0) {
                loadPage();
            }

            return d;
        }
        catch(err) {
            return null;
        }
    }
}

var CrsaProject = function() {
    this.name = 'Project';
    this.root = null;
    this.localPath = null;
    this.url = null;
    this.entityMap = {};
    this.frameworks = [];

    var pages_cache = {};

    this.path_separator = require('path').sep;

    var _this = this;
    var url_to_file_map = {};
    var expanded_folders = {};
    var projectFiles = {};

    this.addBackgroundPage = function(page) {
        pages_cache[page.url] = page;
    }

    this.getBackgroundPageForUrl = function(url) {
        return pages_cache[url] || null;
    }

    this.removeBackgroundPageForUrl = function(url) {
        if(url in pages_cache) delete pages_cache[url];
    }

    this.getAllBackgroundPages = function() {
        return Object.keys(pages_cache).map(function (key) {
            return pages_cache[key];
        });
    }

    var updateFileNamesIndex = function (force) {
        force = force || false;
        if (force || Object.keys(projectFiles).length === 0) {
            projectFiles = {};
            _this.root.walkThroughFiles(function(node) {
                if (!projectFiles[node.name]) {
                    projectFiles[node.name] = [];
                }
                projectFiles[node.name].push(node);
            });
        }
    }

    this.getFilesWithName = function (name) {
        return (name in projectFiles) ? projectFiles[name] : [];
    }

    this.getFile = function(path) {
        var paths = path.split('/');
        var current_node = this.root;
        for(var i = 0; i < paths.length; i++) {
            var p = paths[i];
            if(p.length == 0) continue;

            for(var n = 0; n < current_node.children.length; n++) {
                var child = current_node.children[n];
                if(child.name == p) {
                    if(child.isFile || i == paths.length - 1) {
                        return child;
                    } else {
                        current_node = child;
                        break;
                    }
                }
            }
        }
        return null;
    }

    this.toJSON = function() {
        var d = {};
        d.name = this.name;
        d.root = this.root;
        d.localPath = this.localPath;
        d.url = this.url;

        return JSON.stringify(d);
    }

    this.getDocuments = function() {
        var list = [];
        $.each(this.root.children, function(i,f) {
            if(f.name.match(/\.html$/i)) list.push(f);
        });
        return list;
    }

    this.fromSimpleTemplate = function(def) {
        this.url = def.url;
        this.name = def.name;

        this.description = def.description || null;
        this.author = def.author || null;
        this.author_link = def.author_link || null;
        this.info_badge = def.info_badge || null;

        if(def.frameworks) {
            this.frameworks = def.frameworks;
        }

        this.root = new CrsaFile();
        this.root.isFile = false;
        this.root.name = def.name;
        this.root.url = def.url;

        var path = crsaGetAppDir();
        this.root.path = path + crsaMakeFileFromUrl(def.url);

        var addPages = function(pages, node, url) {
            var sep = isApp() ? require('path').sep : '/';
            $.each(pages, function(i,p) {
                if(!p.children) {
                    var f = new CrsaFile();
                    f.name = p.src;
                    f.isFile = true;
                    f.url = url + f.name;
                    if(path) f.path = node.path + f.name;
                    if(p.tag) f.tag = p.tag;
                    if(p.required) f.required = true;
                    f.image = p.image ? url + p.image : url + 'screenshots' + sep + f.name.replace('html', 'jpg');
                    node.children.push(f);
                } else {
                    var d = new CrsaFile();
                    d.name = p.src;
                    d.isFile = false;
                    d.url = url + d.name;
                    if(p.tag) d.tag = p.tag;
                    if(p.required) d.required = true;
                    if(path) d.path = node.path + d.name + sep;
                    node.children.push(d);
                    addPages(p.children, d, d.url + sep);
                }
            });
        }
        addPages(def.pages, _this.root, def.url);
        updateFileNamesIndex(true);
    }

    this.openProjectBySelectingFolder = function(done) {
        crsaChooseFile(function(url, file) {
            _this.fromFolder(file, done, true);
        }, false, false, null, true);
    }

    this.reload = function(done) {
        this.fromFolder(this.getDir(), done, this.show_pg_files || false);
    }

    this.fromFolder = function(dir, done, show_pg_files, limit_files) {
        this.url = crsaMakeUrlFromFile(dir);
        this.name = decodeURIComponent(crsaGetNameFromUrl(this.url));
        this.show_pg_files = show_pg_files;

        this.root = new CrsaFile();
        this.root.isFile = false;
        this.root.name = this.name;
        this.root.url = this.url;

        this.file_count = 0;
        this.file_size_count = 0;
        this.too_many_files = false;

        var path = dir;
        this.root.path = path;

        var fs = require('fs');
        var pathmodule = require('path');
        var sep = pathmodule.sep;

        url_to_file_map = {};

        var ignore_folders = [];
        var folders = service.getSetting('ignore-folders', 'node_modules');
        try {
            ignore_folders = folders.split(',');
            for(var i = 0; i < ignore_folders.length; i++) {
                ignore_folders[i] = $.trim(ignore_folders[i]);
            }
        } catch(err) {}

        var shouldIgnoreFolder = function(folder) {
            var r = ignore_folders.indexOf(folder) >= 0;
            return r;
        }

        var walk = function(node, dir, done) {
            var results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                var pending = list.length;
                if (!pending) return done(null, results);

                list.forEach(function(filename) {

                    if(filename.charAt(0) == '.' || shouldIgnoreFolder(filename) || (!show_pg_files && (filename == '_pgbackup' || filename == 'pinegrow.json' || filename == '_pgexport'))) {
                        if (!--pending) done(null, results);
                        return true;
                    }
                    var file = pathmodule.resolve(dir, filename);

                    fs.stat(file, function(err, stat) {
                        _this.file_count++;

                        if(stat && stat.size) {
                            _this.file_size_count += stat.size;
                        }
                        if(limit_files && (_this.file_count > 1000 || _this.file_size_count > 1024 * 1024 * 100)) {
                            _this.too_many_files = true;
                            if (!--pending) done(null, results);
                            return;
                        }

                        if (stat && stat.isDirectory()) {
                            var d = new CrsaFile();
                            d.name = filename;
                            d.isFile = false;
                            d.url = node.url + '/' + d.name;
                            d.path = file + sep;
                            node.children.push(d);

                            url_to_file_map[d.url] = d;

                            walk(d, file, function(err, res) {
                                results = results.concat(res);
                                if (!--pending) done(null, results);
                            });
                        } else {
                            var f = new CrsaFile();
                            f.name = filename;
                            f.isFile = true;
                            f.url = node.url + '/' + f.name;
                            f.path = file;
                            f.isEditable = service.isFileEditable(file);
                            node.children.push(f);

                            url_to_file_map[f.url] = f;

                            results.push(file);
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };
        walk(_this.root, dir, function(err) {
            updateFileNamesIndex(true);
            done(_this);
        });
    }

    this.walkThroughFiles = function(func, node) {
        node = node || this.root;
        var r = func(node);
        if(r === false) return;
        for(var i = 0; i < node.children.length; i++) {
            this.walkThroughFiles(func, node.children[i]);
        }
    }

    this.findFilesByName = function(name) {
        var r = [];
        this.walkThroughFiles(function(node) {
            if(node.name == name) r.push(node);
        })
        return r;
    }

    var sortNodeChildren = function(node) {
        node.children.sort( function(a, b) {
            return ((a.isFile ? 'b' : 'a') + a.name).localeCompare((b.isFile ? 'b' : 'a') + b.name);
        })
        for(var i = 0; i < node.children.length; i++) {
            sortNodeChildren( node.children[i]);
        }
    }

    this.sortItems = function() {
        sortNodeChildren(this.root);
    }

    this.getFileForUrl = function(url) {
        return url_to_file_map[url] || null;
    }

    this.find$liForUrl = function(url) {
        if(!$currentContainer) return null;
        var $li = $currentContainer.find('li[data-url="' + url + '"]');
        return $li.length ? $li : null;
    }

    var makeTagsHtml = function(file) {
        var tags = '';
        for(var i = 0; i < file.tags.length; i++) {
            var c = 'tag-type-' + (file.tags[i].type || 'info');
            var text = file.tags[i].icon ? '<i class="fa fa-' + file.tags[i].icon + '"></i>' : file.tags[i].text;
            tags += '<tag class="' + c + '"' + (file.tags[i].desc ? ' title="' + file.tags[i].desc + '"' : '') + '>' + text + '</tag>';
        }
        return tags;
    }

    this.updateTagsForFile = function(file, $li) {
        if(!$li) $li = this.find$liForUrl(file.url);
        if($li) {
            $li.find('>name tags').html(makeTagsHtml(file));
        }
    }

    var $currentContainer;

    this.closeProjectExplorer = function($lib) {
        //$lib.find('>.header').html('');
        $lib.find('>.content').html('');
    }

    this.showProjectExplorer = function($lib) {

        this.sortItems();

        var $container = $lib;

        $currentContainer = $lib;

        var filter = null;
        var $header = $lib.find('>.header').html('');
        var $input = $('<input/>', {class: 'form-control filter-form', placeholder: 'search'}).appendTo($header);
        crsaAddCancelSearch($input, 'top: 16px;right: 46px;');
        /* var $cancel = $('<a/>', {class: 'btn btn-link', href: '#'}).html('&times;').appendTo($lib).on('click', function(e) {
         e.preventDefault();
         $input.val('').trigger('input');
         })*/
        var selectedCrsaPage;

        var $manage = $('<a href="#" class="icon-action"><i class="fa fa-cog"></i></a>').appendTo($header);
        $manage
            .on('click', function(e) {
                e.preventDefault();
                $.fn.crsacss('showFrameworkManager', pinegrow.getSelectedPage());
            })
            .tooltip({container: 'body', placement: 'right', title: 'Manage libraries and plugins.', trigger: 'hover'});


        var $content = $lib.find('>.content').html('');

        var $list = $('<ul/>').appendTo($content);

        var currentPage = null;

        var pageChanged = function(crsaPage) {
            if(currentPage) {
                var $li = _this.find$liForUrl(currentPage.url);
                if($li) {
                    $li.removeClass('selected-page');
                }
            }
            currentPage = crsaPage;
            if(crsaPage) {
                var $li = _this.find$liForUrl(crsaPage.url);
                if($li) {
                    $li.addClass('selected-page');
                }
            }
            updateUsage();
        }

        $('body').off('crsa-page-selected.project');

        $('body').on('crsa-page-selected.project', function(e, crsaPage) {
            pageChanged(crsaPage);
        });


        $('body').off('crsa-element-selected.project');

        $('body').on('crsa-element-selected.project', function(e, crsaPage) {
            var page = pinegrow.getSelectedPage();
            if(currentPage != page) {
                pageChanged(page);
            }
        });

        var getFileForPath = function(path) {
            var a = path.split(',');
            var n = _this.root;
            for(var i = 1; i < a.length; i++) {
                var idx = parseInt(a[i]);
                if(n.children.length <= idx) return null;
                n = n.children[idx];
            }
            return n;
        }




        var updateList = function(sections) {
            var handlers = {
                on_project_menu : [],
                on_project_item_get_tags : [],
                on_project_item_get_context_menu : [],
                on_project_item_preview : []
            };

            $.each(pinegrow.getFrameworks(), function(key, f) {
                $.each(handlers, function(handler, list) {
                    if(handler in f && f[handler]) {
                        list.push(f[handler]);
                    }
                });
            });

            var callHandler = function(handler, a, b, c) {
                var cp = pinegrow.getSelectedPage();
                var r = [];
                for(var i = 0; i < handlers[handler].length; i++) {
                    var ret = handlers[handler][i](cp, a, b, c);
                    if(ret) r.push(ret);
                }
                return r;
            }

            var $scroll = $('.crsa-project-list');
            var showMenu = function(menu_items_sets, e) {
                var $menu = new CrsaContextMenu();

                for(var i = 0; i < menu_items_sets.length; i++) {
                    for(var m = 0; m < menu_items_sets[i].length; m++) {
                        if(menu_items_sets[i][m].divider) {
                            $menu.add("", null, null, 'divider');
                            if(menu_items_sets[i][m].header) {
                                $menu.add(menu_items_sets[i][m].header, null, null, 'header');
                            }
                        } else {
                            $menu.add(menu_items_sets[i][m].label, menu_items_sets[i][m].key || null, menu_items_sets[i][m].func);
                        }
                    }
                }
                $menu.showAt(e.pageX, e.pageY, $scroll);
                $menu.updatePosition();
            }

            var selectedCrsaPage = currentPage;
            $list.html('');

            $content.find('>h2').remove();
            var $title = $('<h2 class="project-name"></h2>').prependTo($content);

            $title.html(_this.name + '&nbsp;<span class="caret"></span>');

            $title.on('click contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var menu_items_sets = callHandler( 'on_project_menu', _this);
                if(menu_items_sets.length) {
                    showMenu(menu_items_sets, e);
                }
            })

            filter = $input.val();
            var filterRegEx = filter && filter.length > 0 ? new RegExp(escapeRegExp(filter),'i') : null;

            var html = '';

            var showLevel = function(node, path) {
                for(var i = 0; i < node.children.length; i++) {
                    var n = node.children[i];
                    var item_path = path + ',' + i;
                    var icon = '';
                    var classes = '';
                    if(!n.isFile) {
                        if (expanded_folders[n.url]) {
                            icon = '<i class="folder-icon fa fa-caret-down"></i>';
                        }
                        else {
                            icon = '<i class="folder-icon fa fa-caret-right"></i>';
                            classes = "folder-closed";
                        }

                    }
                    var name_class = n.isEditable ? 'editable' : '';

                    html += '<li class="project-item ' + (n.isFile ? "file" : "folder " + classes) + '" data-path="' + item_path + '" data-file-name="' + n.name + '" data-url="' + n.url + '">' + icon + '<name class="' + name_class + '">' + n.name + '<tags>' + makeTagsHtml(n) + '</tags></name>';

                    if(n.children.length) {
                        html += '<ul>';
                        showLevel(n, item_path);
                        html += '</ul>';
                    }
                    html += '</li>';
                }
            }

            showLevel(_this.root, '');

            $list.html(html);

            $list.find('li.project-item name, li.project-item i.folder-icon')
                .on('contextmenu.project', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    var $el = $(e.delegateTarget);
                    var $li = $el.closest('li');
                    var file = getFileForPath($li.attr('data-path'));

                    var menu_items_sets = callHandler( 'on_project_item_get_context_menu', file, _this);

                    if(menu_items_sets.length) {
                        showMenu(menu_items_sets, e);
                    }
                })
                .on('click.project', function(e) {
                    var $el = $(e.delegateTarget);
                    e.preventDefault();
                    //$el.closest('li').toggleClass('crsa-action-closed');
                    var $li = $el.closest('li');
                    var file = getFileForPath($li.attr('data-path'));
                    //console.log(file);
                    if(file) {
                        if(file.isFile) {
                            if(file.isEditable) {
                                var partial_info = pgGetOpenPartialInContainerInfo(file.path);
                                if(partial_info && partial_info.auto_open) {
                                    new pgOpenPartialInContainer(file.url);
                                    pinegrow.stats.using('prj.openpartial');
                                } else {
                                    var show_one = !e.ctrlKey && !e.metaKey;
                                    if(show_one) pinegrow.pageTabs.hideAll();
                                    pinegrow.openOrShowPage(file.url, function(cp) {

                                    }, show_one, true /* select openned page */);
                                    pinegrow.stats.using('prj.openfile');
                                }
                            } else {

                                if(pinegrow.openFileInCodeEditor(file.path)) {
                                    pinegrow.showQuickMessage('This file can be only opened in code editor.');
                                }
                                //pinegrow.stats.using('prj.editcode');
                            }
                        } else if(!file.isFile) {
                            var $li = $el.closest('li');
                            var $icon = $li.find('> .folder-icon');
                            if($li.hasClass('folder-closed')) {
                                $li.removeClass('folder-closed');
                                $icon.removeClass('fa-caret-right').addClass('fa-caret-down');
                                expanded_folders[file.url] = true;
                            } else {
                                $li.addClass('folder-closed');
                                $icon.removeClass('fa-caret-down').addClass('fa-caret-right');
                                expanded_folders[file.url] = false;
                            }
                        }
                    }
                })
                .on('mouseenter.project', function(e) {
                    var $el = $(e.delegateTarget);
                    e.preventDefault();
                    var $li = $el.closest('li');
                    var file = getFileForPath($li.attr('data-path'));

                    var p = callHandler('on_project_item_preview', file);

                    if(p.length) {
                        var $pel = $(p[0]);
                        if($pel.length) {
                            pinegrow.showPreview($li, $pel, $pel.is('img') ? 'with-image' : null, 300, null /* code */);
                        }
                    }
                })
                .on('mouseleave.project', function(e) {
                    pinegrow.hidePreview();
                });

            updateUsage();

        }

        var updateUsage = function() {

        }
        updateList();

        var updateFilter = function(filter) {
            var re = filter.length > 0 ? new RegExp(escapeRegExp(filter), 'i') : null;
            var $all = $container.find('li.project-item');
            if(!re) {
                $all.removeClass('found not-found has-found');
            } else {
                $all.removeClass('has-found');
                $all.each(function(i, a) {
                    var $li = $(a);
                    var name = $li.attr('data-file-name');
                    var found = re && name.match(re);
                    if(found) {
                        $li.addClass('found').removeClass('not-found');

                        var $pli = $li.parent().closest('li.project-item');
                        while($pli.length) {
                            if($pli.hasClass('has-found')) {
                                break;
                            }
                            $pli.addClass('has-found');
                            $pli = $pli.parent().closest('li.project-item');
                        }

                    } else {
                        $li.removeClass('found').addClass('not-found');
                    }
                });
            }
        }

        $input.on('input', function() {
            updateFilter($input.val());
        });

    }

    this.copyRequiredFilesTo = function(dir, filter_func, fileWriter, only_dirs) {
        var fs = require('fs');
        var path = require('path');

        var copyNodes = function(nodes, dest) {
            $.each(nodes, function(i, cf) {
                var req = cf.required || (filter_func && filter_func(cf));
                if(!req) return true;
                var dest_path = dest + cf.name;
                var exists = crsaIsFileOrDir(dest_path, fs);

                if(exists && cf.isFile && !only_dirs) {
                    var sourcestat = fs.statSync(cf.path);
                    var deststat = fs.statSync(dest_path);
                    if(/* deststat.mtime < sourcestat.mtime || */ fileWriter) { //this was dangerous
                        exists = false; //overwrite
                    }
                }
                if(!exists) {
                    if(cf.isFile) {
                        if(!only_dirs) {
                            //console.log('copy ' + cf.path + ' to ' + dest_path);
                            if(!fileWriter) {
                                crsaCopyFileSync(fs, cf.path, dest_path);
                            } else {
                                fileWriter.copyFile(dest_path, cf.path);
                            }
                        }
                    } else {
                        fs.mkdirSync(dest_path);
                    }
                }
                if(cf.children) {
                    copyNodes(cf.children, dest_path + path.sep);
                }
            });
        }
        copyNodes(this.root.children, dir);
    }

    this.copyRequiredFilesToZip = function(zip, done) {

        var count = 0;

        var copyNodes = function(nodes, zip, folder) {

            $.each(nodes, function(i, cf) {
                if(!cf.required) return true;

                if(cf.isFile) {
                    console.log('copy ' + cf.url + ' to ' + folder);
                    count++;
                    $.ajax({
                        url: cf.url,
                        data: null,
                        dataType: 'text'
                    }).done(function(data) {
                            setTimeout(function() {
                                zip.file(cf.name, data);
                                count--;
                                if(count == 0) done();
                            }, 0);
                        }).fail(function() {
                            setTimeout(function() {
                                count--;
                                console.log('can not read ' + cf.url);
                                if(count == 0) done();
                            }, 0);
                        });
                } else {
                    var subzip = zip.folder(cf.name);
                    if(cf.children) {
                        copyNodes(cf.children, subzip, folder + '/' + cf.name);
                    }
                }
            });
        }
        copyNodes(this.root.children, zip, '/');
        if(count == 0) done();
    }

    //project API
    this.getDir = function() {
        return this.root.path;
    }

    this.getUrl = function() {
        return this.root.url;
    }

    this.getName = function() {
        return this.root.name;
    }

    this.isFileInProject = function(file) {
        return file.startsWith( this.getDir());
    }

    this.isUrlInProject = function(url) {
        return url.startsWith( this.getUrl());
    }

    this.isPageInProject = function(page) {
        return page.localFile && this.isFileInProject(page.localFile);
    }

    this.getProjectInfo = function() {
        return new pgProjectInfo(this.getDir());
    }

    this.getRelativeUrl = function (url) {
        var relativeUrl = url.replace(this.getUrl(), '');
        if (relativeUrl[0] == "/")
            relativeUrl = relativeUrl.substr(1, relativeUrl.length);
        return relativeUrl;
    }

    this.getRelativePath = function(file) {
        return file.replace( this.getDir() + this.path_separator, '');
    }

    this.getAbsolutePath = function(relative_file) {
        return path.join( this.getDir(), relative_file);
    }

    this.getAbsoluteUrl = function(relative_file) {
        return crsaMakeUrlFromFile( this.getAbsolutePath( relative_file ));
    }

    this.forEachOpenPage = function(func, ref_page) {
        if(ref_page && !this.isPageInProject(ref_page)) return;
        var pages = pinegrow.getAllPages();
        for (var i=0; i < pages.length; i++) {
            if(this.isPageInProject(pages[i])) {
                if(ref_page && ref_page == pages[i]) continue;
                func(pages[i]);
            }
        }
    }

    this.forEachEditableFile = function(func, done, title, reference) {

        if(!title) title = 'Processing files...';

        var errors = [];
        var summary = [];

        var files = [];

        var progressUI = function() {

            var $ui = $('<div><p>index.html(90 of 100)</p>\
            <div class="progress">\
                <div class="progress-bar" style="width: 0%;">\
                </div>\
            </div></div>');

            var $title = $ui.find('h3');
            var $txt = $ui.find('p');
            var $bar = $ui.find('.progress-bar');

            var $dialog = makeAndShowDialog(title, null, "Stop", $ui, function() {
                $dialog = null;
            }, function() {
                $dialog = null;
                stopProcessing();
            });
            $dialog.css('z-index', 2000);

            this.hide = function() {
                if($dialog) {
                    $dialog.remove();
                    $dialog = null;
                }
            }

            this.update = function(file, num, total) {
                var percent = parseInt(num * 100 / total);
                $bar.attr("style", "width:" + percent + "%;");
                $txt.html(file + ' (' + num + ' of ' + total + ')');
            }
        }

        var onDone = function() {
            pinegrow.callGlobalFrameworkHandler('on_project_scan_end', _this, reference);

            ui.update('Done!', files.length, files.length);
            files = null;
            if(summary.length) {
                ui.hide();
                var str = '<table class="table table-striped table-condensed table-hover"><thead><tr><td>File</td><td>Messages</td></tr></thead><tbody>';
                for(var i = 0; i < summary.length; i++) {
                    str += '<tr><td><b>' + _this.getRelativePath(summary[i].file.path) + '</b></td><td>';
                    for(var j = 0; j < summary[i].status.errors.length; j++) {
                        str += '<p class="error">' + summary[i].status.errors[j] + '</p>';
                    }
                    for(var j = 0; j < summary[i].status.warnings.length; j++) {
                        str += '<p class="warning">' + summary[i].status.warnings[j] + '</p>';
                    }
                    for(var j = 0; j < summary[i].status.messages.length; j++) {
                        str += '<p class="message">' + summary[i].status.messages[j] + '</p>';
                    }
                    str += '</td></tr>';
                }
                str += '</tbody></table>';

                pinegrow.showAlert('<p>The following happened during processing:</p>' + str, 'Status report', null, "OK", function() {
                    if(done) done(errors);
                }, function() {
                    if(done) done(errors);
                });
            } else {
                setTimeout(function() {
                    ui.hide();
                }, 500);
                if(done) done(errors);
            }
        }

        var findNodes = function(node) {

            if(node.isEditable) {
                files.push(node);
            }
            if(!node.name.startsWith('_pg')) {
                for(var i = 0; i < node.children.length; i++) {
                    findNodes( node.children[i] );
                }
            }
        }

        findNodes(this.root);

        var idx = 0;
        var nextFileTimer = null;

        var stopProcessing = function() {
            if(nextFileTimer) clearTimeout(nextFileTimer);
            nextFileTimer = null;
            idx = files.length;
            onDone();
        }

        pinegrow.callGlobalFrameworkHandler('on_project_scan_begin', this, reference);

        var doNode = function() {

            nextFileTimer = null;
            if(idx < files.length) {
                var node = files[idx];

                ui.update(node.name, idx + 1, files.length);

                try {
                    var page = pinegrow.getCrsaPageForUrl( node.url );


                    //idx++;
                    //nextFileTimer = setTimeout(doNode, 1);
                    var status = new pgProjectItemIteratorStatus();

                    func( page, function( page, status ) {
                        var changed = status && status.changed;
                        if(changed) {
                            if(page.openedInEditor) {
                                page.refresh();
                            } else {
                                pages_cache[page.url] = page; //store page
                            }
                            page.setPageChanged(true, true /* force update */);
                        }
                        if(status) {
                            if(status.errors.length || status.warnings.length || status.messages.length) {
                                summary.push({file: node, status: status });
                            }
                        }
                        idx++;
                        var time = (new Date().getTime());
                        if(time - node_batch_start_time < 50) {
                            doNode();
                        } else {
                            node_batch_start_time = time;
                            nextFileTimer = setTimeout(doNode, 1);
                        }
                    }, status, node);

                    pinegrow.callGlobalFrameworkHandler('on_project_scan_page', _this, page, reference);

                    page = null;

                } catch(err) {
                    var status = new pgProjectItemIteratorStatus();
                    status.errors.push(err.toString());
                    //errors.push({file: node, error: err.toString()});
                    idx++;
                    //doNode();
                    nextFileTimer = setTimeout(doNode, 1);

                    console.log('FOR EACH ERROR ' + err);
                }

            } else {
                //done
                onDone();
            }
        }
        var ui = new progressUI();

        var node_batch_start_time = (new Date().getTime());
        doNode();
    }

    this.getFrameworks = function() {
        var list = [];
        var pi = new pgProjectInfo(this.getDir());
        var keys = pi.getSetting('frameworks');
        if(keys) {
            for(var i = 0; i < keys.length; i++) {
                var f = pinegrow.findFrameworkByKey(keys[i])
                if(f) {
                    list.push(f);
                }
            }
        }
        return list;
    }
}

var pgProjectItemIteratorStatus = function() {
    this.changed = false;
    this.viewUpdated = false;
    this.errors = [];
    this.warnings = [];
    this.messages = [];
}

var pgProjectInfo = function(file_or_dir, dont_search) {

    var path = require('path');
    var fs = require('fs');

    var getFileNameRelativeToProject = function(file, project_dir) {
        return file.replace( project_dir + path.sep, '');
    }

    var findAndReadProjectFile = function(file, dont_search) {
        if(!file || !isApp()) return null;

        var dir = crsaGetDir(file, path, fs);

        while(dir) {
            var pf = path.join(dir, 'pinegrow.json');
            try {
                var json = fs.readFileSync(pf, {encoding: "utf8"});
                var info = JSON.parse(json);
                //console.log('Project file found: ' + pf);
                var relative_name = file.replace( dir, '');
                return {data: info, file: pf, project_dir: dir, file_key: getFileNameRelativeToProject(file, dir)};
            } catch(err) {

            }
            if(dont_search) break;

            try {
                var parent_dir = path.join(dir, '..');
                if(parent_dir == dir) break;
                dir = parent_dir;
            }
            catch(err) {
                break;
            }
        }
        return null;
    }

    var getNewProjectInfo = function(file) {
        if(!file) return {file: null, project_dir: null, data: { files: {}}, file_key: null};

        //var existing = findAndReadProjectFile();
        //if(existing) return existing.file;

        //no file yet

        var project = pinegrow.getCurrentProject();
        var pf;

        if(project && project.isFileInProject(file)) {
            pf = path.join(project.getDir(), 'pinegrow.json');
        }
        pf = path.join( crsaGetDir(file, path, fs), 'pinegrow.json');
        var project_dir = path.dirname(pf);
        return {file: pf, project_dir: project_dir, data: { files: {}}, file_key: getFileNameRelativeToProject( file, project_dir)};
    }

    var saveProjectInfo = function(info) {
        var fs = require('fs');
        var json = JSON.stringify(info.data);
        crsaWriteFileWithBackup(fs, info.file, json, "utf8");
    }

    debugger;
    var info = findAndReadProjectFile( file_or_dir, crsaIsFileOrDir(file_or_dir) == 'dir' || dont_search );
    if(!info) {
        info = getNewProjectInfo( file_or_dir );
    }
    this.save = function() {
        saveProjectInfo(info);
    }

    this.getSetting = function(key) {
        return info.data[key] || null;
    }

    this.setSetting = function(key, value) {
        info.data[key] = value;
    }

    this.getSettingsForFile = function(file) {
        if(!file) return null;
        var r = getFileNameRelativeToProject( file, info.project_dir );
        if(info.data.files && info.data.files[r]) {
            return info.data.files[r];
        }
        return null;
    }

    this.getSettingForFile = function(file, key) {
        if(!file) return null;
        var r = getFileNameRelativeToProject( file, info.project_dir );
        if(info.data.files && info.data.files[r]) {
            return info.data.files[r][key] || null;
        }
        return null;
    }

    this.setSettingForFile = function(file, key, value) {
        var r = getFileNameRelativeToProject( file, info.project_dir );
        if(!info.data.files) {
            info.data.files = {};
        }
        if(!info.data.files[r]) {
            info.data.files[r] = {};
        }
        info.data.files[r][key] = value;
    }

}

var CrsaFileTag = function(text, type, desc, icon) {
    this.text = text;
    this.type = type;
    this.desc = desc;
    this.icon = icon;
}

var CrsaFile = function(entityMapObject) {
    this.isFile = true;
    this.name = null;
    this.path = null;
    this.url = null;
    this.children = [];
    this.entity = null;
    this.image = null;
    this.required = false;
    this.tag = null;
    this.tags = [];



    var entityMap = entityMapObject;

    this.fromEntity = function(entity) {
        this.isFile = entity.isFile;
        this.name = entity.name;
        this.path = entity.fullPath;
        if(entityMap) entityMap[this.path] = entity;
        return this;
    }

    this.fromFile = function(filepath) {
        var fs = require('fs');
        var path = require('path');
        var stat = fs.statSync(filepath);

        this.isFile = stat.isFile();
        this.name = path.basename(filepath);
        this.url = crsaMakeUrlFromFile(filepath);
        this.path = filepath;
    }

    this.getEntity = function() {
        if(entityMap && this.path && this.path in entityMap) return entityMap[this.path];
        return null;
    }

    this.walkThroughFiles = function(func) {
        for(var i = 0; i < this.children.length; i++) {
            var n = this.children[i];
            func(n);
            n.walkThroughFiles(func);
        }
    }


    this.addTag = function(tagObj) {
        for(var i = 0; i < this.tags.length; i++) {
            if(this.tags[i].text == tagObj.text) return;
        }
        this.tags.push(tagObj);
    }

    this.hasTag = function(tag) {
        for(var i = 0; i < this.tags.length; i++) {
            if(this.tags[i].text == tag) return true;
        }
        return false;
    }

    this.removeTag = function(tag) {
        for(var i = 0; i < this.tags.length; i++) {
            if(this.tags[i].text == tag) {
                this.tags.splice(i,1);
                return;
            }
        }
    }

    this.removeTags = function() {
        this.tags = [];
    }

    var copyFile = function(currentFilePath, newFilePath) {
        var path = require('path');
        var fs = require('fs');

        crsaCopyFileSync(fs, currentFilePath, newFilePath);
        var new_file = new CrsaFile();
        new_file.fromFile(newFilePath);
        return new_file;
    }

    this.duplicate = function(new_name, overwrite) {
        var path = require('path');
        var fs = require('fs');
        var new_path = path.join(path.dirname( this.path), new_name);
        var exists = false;
        try {
            fs.statSync(new_path);
            exists = true;
        } catch(err) {
        }
        if (exists && !overwrite) {
            throw "File " + new_name + " already exists.";
        }
        return copyFile(this.path, new_path);
    }

    this.copyFileToNewPath = function (new_path) {
        var fs = require('fs');

        var exists = false;
        try {
            fs.statSync(new_path);
            exists = true;
        } catch(err) {
        }
        if(exists) {
            throw "File " + new_name + " already exists.";
        }
        return copyFile(this.path, new_path);
    }

    var deleteFileAndFolder = function (currentPath) {
        var path = require('path');
        var fs = require('fs');

        if (fs.lstatSync(currentPath).isDirectory()) {
            fs.readdirSync(currentPath).forEach(function(currnetFile, index){
                var curPath = path.join(currentPath, currnetFile);
                if(fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFileAndFolder(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(currentPath);
        }
        else {
            fs.unlinkSync(currentPath);
        }
    }

    this.delete = function() {
        try {
            deleteFileAndFolder(this.path);
        }
        catch(err) {
            return false;
        }
        return true;
    }

    this.rename = function (new_name) {
        var path = require('path');
        var fs = require('fs');

        var new_path = path.join(path.dirname( this.path), new_name);

        fs.renameSync(this.path, new_path);

        if (fs.lstatSync(new_path).isDirectory()) return null;

        var new_file = new CrsaFile();
        new_file.fromFile(new_path);
        return new_file;
    }

    this.doesFileExistInSameDir = function (file_name) {
        var path = require('path');
        var fs = require('fs');

        var file_path = path.join(path.dirname(this.path), file_name);
        return fs.existsSync(file_path);
    }

    this.isDirectoryInTheSameDir = function (file_path) {
        var path = require('path');
        var fs = require('fs');

        var new_path = path.join(path.dirname(this.path), file_path);
        return fs.lstatSync(new_path).isDirectory();
    }
/*
    this.toJSON = function(ident) {
        if(typeof ident == 'undefined') ident = '';
        var s = [];
        s.push(ident + '{');
        s.push('"name" : "' + this.name + '"');
        s.push(', "path" : "' + this.path + '"');
        s.push(', "isFile" : ' + this.isFile ? "true" : "false");
        s.push(', "url" : "' + this.url ? this.url : "" + '"');
        s.push(', "children" : [\n');

        for(var n = 0; n < this.children.length; n++) {
            if(n > 0) s.push(", ");
            s.push(this.children[n].toJSON(ident + '    '));
        }
        s.push("\n" + ident + "]}\n");
        return s.join("");
    }
*/
    return this;
}

var CrsaStore = function() {
    this.type = "AbstractStore"

    this.listProjects = function(search) {

    }

    this.getProject = function(pid, done) {

    }

    this.createProjectFromTemplate = function(template) {

    }

    this.saveProject = function(project) {

    }

    this.deleteProject = function(pid) {

    }

    this.createProjectFile = function(project, path, data) {

    }

    this.saveProjectFile = function(project, path, data) {

    }

    this.deleteProjectFile = function(project, path) {

    }

    this.copyProjectFile = function(project, path_source, path_dest) {

    }

    this.getProjectFileUrl = function(project, path) {

    }
};

var CrsaFileStore = function() {
    this.name = "FileStore";
    this.app = location.protocol == 'chrome-extension:';

    var _this = this;

    this.listProjects = function(search) {

    }

    this.getProject = function(pid, done) {

        chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(dir) {
            console.log(dir);
            _this.loadProject(dir, done);
        });
    }

    this.loadProject = function(dir, done) {
        var project = new CrsaProject();
        project.root = (new CrsaFile(project.entityMap)).fromEntity(dir);

        chrome.fileSystem.getDisplayPath(dir, function(path) {

            project.name = project.root.name;
            project.localPath = path;

            var dirReader = dir.createReader();

            var readingLevel = 0;
            // Call the reader.readEntries() until no more results are returned.
            var readEntries = function(dirReader, node, done) {
                readingLevel++;
                dirReader.readEntries (function(results) {
                    readingLevel--;
                    if (!results.length) {
                        if(readingLevel <= 0) done();
                    } else {
                        for(var n = 0; n < results.length; n++) {
                            var subNode = new CrsaFile(project.entityMap);
                            subNode.fromEntity(results[n]);

                            node.children.push(subNode);

                            if(!subNode.isFile) {
                                var subdirReader = results[n].createReader();
                                readEntries(subdirReader, subNode, done);
                            }
                        }
                        readEntries(dirReader, node, done);
                    }
                }, function(err) {
                    readingLevel--;
                    console.log(err);
                    if(readingLevel <= 0) done();
                });
            };

            readEntries(dirReader, project.root, function() {
                done(project);
            });

        });
        /*   chrome.fileSystem.getWritableEntry(dir, function(writable_dir) {
         console.log("writable dir " + writable_dir);
         });*/
    }

    this.saveProject = function(project) {

    }

    this.createProjectFromTemplate = function(template, done) {
        //read template json
        var url = chrome.runtime.getURL("/templates/" + template + "/pinegrow.json");
        console.log(url);

        $.ajax({
            url: url,
            data: null,
            dataType: 'json'
        })
            .done(function(data) {
                console.log(data);

                chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(dir) {
                    chrome.fileSystem.isWritableEntry(dir, function(writable) {
                        if(writable) {

                            var level = 0;

                            var decreaseLevel = function() {
                                level--;
                                if(level <= 0) {
                                    _this.loadProject(dir, function(p) {
                                        done(p);
                                    });
                                }
                            }

                            var copyTemplateNodeToDest = function(data, dir, done) {
                                console.log('copying dir ' + data.name);

                                for(var i = 0; i < data.children.length; i++) {
                                    var node = data.children[i];
                                    console.log(node.path);

                                    if(node.isFile) {
                                        level++;
                                        var url = chrome.runtime.getURL("/templates/" + template + node.path.replace("/" + template, ""));
                                        var xhr = new XMLHttpRequest();
                                        xhr.open('GET', url, true);
                                        xhr.responseType = 'blob';
                                        xhr.crsaNode = node;
                                        xhr.onload = function(e) {

                                            var node = this.crsaNode;
                                            var blob = this.response;

                                            dir.getFile(node.name, {create: true}, function(fileEntry) {

                                                fileEntry.createWriter(function(fileWriter) {

                                                    fileWriter.onwriteend = function(e) {
                                                        console.log('Write completed.');
                                                        decreaseLevel();
                                                    };

                                                    fileWriter.onerror = function(e) {
                                                        console.log('Write failed: ' + e.toString());
                                                        decreaseLevel();
                                                    };
                                                    fileWriter.write(blob);

                                                }, function(err) {
                                                    decreaseLevel();
                                                    console.log(err);
                                                });

                                            }, function(err) {
                                                decreaseLevel();
                                                console.log(err);
                                            })
                                        };

                                        xhr.send();

                                    } else {
                                        level++;

                                        var func = function(node) {
                                            dir.getDirectory(node.name, {create: true}, function(dirEntry) {

                                                copyTemplateNodeToDest(node, dirEntry, done);
                                                decreaseLevel();

                                            }, function(err) {
                                                decreaseLevel();
                                                console(err);
                                            });
                                        }
                                        func(node);
                                    }
                                }
                            }

                            copyTemplateNodeToDest(data.root, dir, function() {
                                console.log("template copied to project.")
                            });

                        } else {
                            console.log(dir + ' is not writable.');
                        }
                    });
                    console.log(dir);
                });
            })
            .fail(function(err) {
                console.log(err);
            });


        //get writable dir
        //check if dir is empty
        //copy files


    }

    this.deleteProject = function(pid) {

    }

    this.createProjectFile = function(project, path, data) {

    }

    this.saveProjectFile = function(project, path, data) {

    }

    this.deleteProjectFile = function(project, path) {

    }

    this.copyProjectFile = function(project, path_source, path_dest) {

    }

    this.getProjectFileUrl = function(project, path) {

    }
}

CrsaFileStore.prototype = new CrsaStore();
